import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import type { DNSRecord } from "#domeneshop/index.js";
import { resultText, withHarness } from "#testing/mcpHarness.js";
import { sendJson } from "#testing/testServer.js";

/**
 * A tiny in-memory DNS zone behind the test server, so patch/upsert can be
 * exercised through their full read-then-write sequence.
 */
function fakeZone(initial: DNSRecord[]) {
  const records = new Map(initial.map((r) => [r.id ?? 0, { ...r }]));
  let nextId = 100;

  const handler = (req: IncomingMessage, res: ServerResponse, body: string): void => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const match = /^\/domains\/42\/dns(?:\/(\d+))?$/.exec(url.pathname);
    if (!match) {
      res.writeHead(404);
      res.end();
      return;
    }
    const id = match[1] ? Number(match[1]) : undefined;

    if (req.method === "GET" && id === undefined) {
      const host = url.searchParams.get("host");
      const type = url.searchParams.get("type");
      sendJson(
        res,
        200,
        [...records.values()].filter(
          (r) => (host === null || r.host === host) && (type === null || r.type === type),
        ),
      );
    } else if (req.method === "GET" && id !== undefined) {
      const record = records.get(id);
      if (record) {
        sendJson(res, 200, record);
      } else {
        res.writeHead(404);
        res.end();
      }
    } else if (req.method === "PUT" && id !== undefined) {
      records.set(id, { ttl: 3600, ...(JSON.parse(body) as DNSRecord), id });
      res.writeHead(204);
      res.end();
    } else if (req.method === "POST") {
      const newId = nextId++;
      records.set(newId, { ttl: 3600, ...(JSON.parse(body) as DNSRecord), id: newId });
      sendJson(res, 201, { id: newId });
    } else {
      res.writeHead(405);
      res.end();
    }
  };

  return { records, handler };
}

describe("dns record tools", () => {
  it("lists DNS records for a domain", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 200, [{ id: 1, host: "www", type: "A", data: "1.2.3.4" }]);
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "list_dns_records",
          arguments: { domain_id: 42 },
        });

        expect(result.isError).not.toBe(true);
        expect(resultText(result)).toContain("1.2.3.4");
        expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/dns");
      },
    );
  });

  it("lists MX and SRV records whose numeric fields the API sends as strings", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 200, [
          { id: 1, host: "@", type: "MX", data: "mx.example.com", priority: "10" },
          {
            id: 2,
            host: "_sip._tcp",
            type: "SRV",
            data: "sip.example.com",
            priority: "10",
            weight: "100",
            port: "5060",
          },
        ]);
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "list_dns_records",
          arguments: { domain_id: 42 },
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent).toEqual({
          records: [
            { id: 1, host: "@", type: "MX", data: "mx.example.com", priority: 10 },
            {
              id: 2,
              host: "_sip._tcp",
              type: "SRV",
              data: "sip.example.com",
              priority: 10,
              weight: 100,
              port: 5060,
            },
          ],
        });
      },
    );
  });

  it("gets a single DNS record", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 200, { id: 7, host: "www", type: "A", data: "1.2.3.4" });
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "get_dns_record",
          arguments: { domain_id: 42, record_id: 7 },
        });

        expect(result.isError).not.toBe(true);
        expect(resultText(result)).toContain("1.2.3.4");
        expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/dns/7");
      },
    );
  });

  it("updates a DNS record, sending every field through to the API", async () => {
    let received: Record<string, unknown> = {};
    await withHarness(
      (req, res, body) => {
        if (req.method === "GET") {
          sendJson(res, 200, { id: 7, ...received });
          return;
        }
        received = JSON.parse(body) as Record<string, unknown>;
        res.writeHead(204);
        res.end();
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_dns_record",
          arguments: {
            domain_id: 42,
            record_id: 7,
            host: "www",
            type: "A",
            data: "5.6.7.8",
            ttl: 120,
          },
        });

        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests[0]?.method).toBe("PUT");
        expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/dns/7");
        expect(received["data"]).toBe("5.6.7.8");
        expect(received["ttl"]).toBe(120);
        expect(harness.apiServer.requests[1]?.method).toBe("GET");
        expect(resultText(result)).toContain("5.6.7.8");
      },
    );
  });

  it("returns the record that was sent when the read-back after a write fails", async () => {
    await withHarness(
      (req, res) => {
        if (req.method === "GET") {
          res.writeHead(500);
          res.end();
          return;
        }
        res.writeHead(204);
        res.end();
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_dns_record",
          arguments: { domain_id: 42, record_id: 7, host: "www", type: "A", data: "5.6.7.8" },
        });

        expect(result.isError).not.toBe(true);
        expect(result.structuredContent).toMatchObject({ id: 7, data: "5.6.7.8" });
      },
    );
  });

  it("deletes a DNS record", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(204);
        res.end();
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "delete_dns_record",
          arguments: { domain_id: 42, record_id: 7 },
        });

        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests[0]?.method).toBe("DELETE");
        expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/dns/7");
      },
    );
  });
});

describe("patch_dns_record", () => {
  it("changes only the given field and keeps ttl and priority", async () => {
    const zone = fakeZone([
      { id: 7, host: "@", type: "MX", data: "mx1.example.com", ttl: 300, priority: 10 },
    ]);
    await withHarness(zone.handler, async (harness) => {
      const result = await harness.client.callTool({
        name: "patch_dns_record",
        arguments: { domain_id: 42, record_id: 7, data: "mx2.example.com" },
      });

      expect(result.isError).not.toBe(true);
      const put = harness.apiServer.requests.find((r) => r.method === "PUT");
      expect(JSON.parse(put?.body ?? "{}")).toEqual({
        host: "@",
        type: "MX",
        data: "mx2.example.com",
        ttl: 300,
        priority: 10,
      });
      expect(result.structuredContent).toMatchObject({ id: 7, data: "mx2.example.com", ttl: 300 });
    });
  });

  it("sends a stored priority the API returned as a string back as a number", async () => {
    const zone = fakeZone([
      {
        id: 7,
        host: "@",
        type: "MX",
        data: "mx1.example.com",
        priority: "10" as unknown as number,
      },
    ]);
    await withHarness(zone.handler, async (harness) => {
      const result = await harness.client.callTool({
        name: "patch_dns_record",
        arguments: { domain_id: 42, record_id: 7, data: "mx2.example.com" },
      });

      expect(result.isError).not.toBe(true);
      const put = harness.apiServer.requests.find((r) => r.method === "PUT");
      expect(JSON.parse(put?.body ?? "{}")).toMatchObject({ priority: 10 });
    });
  });

  it("validates the merged record, e.g. switching to SRV without weight and port", async () => {
    const zone = fakeZone([{ id: 7, host: "_sip._tcp", type: "A", data: "1.2.3.4" }]);
    await withHarness(zone.handler, async (harness) => {
      const result = await harness.client.callTool({
        name: "patch_dns_record",
        arguments: { domain_id: 42, record_id: 7, type: "SRV", priority: 10 },
      });

      expect(result.isError).toBe(true);
      expect(resultText(result)).toContain("missing: weight, port");
      expect(harness.apiServer.requests.some((r) => r.method === "PUT")).toBe(false);
    });
  });

  it("reports a missing record as a tool error", async () => {
    await withHarness(fakeZone([]).handler, async (harness) => {
      const result = await harness.client.callTool({
        name: "patch_dns_record",
        arguments: { domain_id: 42, record_id: 7, data: "x" },
      });

      expect(result.isError).toBe(true);
      expect(resultText(result)).toContain("404");
    });
  });
});

describe("upsert_dns_record", () => {
  it("creates the record when the host has none of that type", async () => {
    const zone = fakeZone([{ id: 1, host: "www", type: "AAAA", data: "2001:db8::1" }]);
    await withHarness(zone.handler, async (harness) => {
      const result = await harness.client.callTool({
        name: "upsert_dns_record",
        arguments: { domain_id: 42, host: "www", type: "A", data: "203.0.113.10" },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        action: "created",
        record: { id: 100, host: "www", type: "A", data: "203.0.113.10" },
      });
      expect(zone.records.size).toBe(2);
    });
  });

  it("updates the single existing record for that host and type", async () => {
    const zone = fakeZone([{ id: 5, host: "www", type: "A", data: "198.51.100.1", ttl: 600 }]);
    await withHarness(zone.handler, async (harness) => {
      const result = await harness.client.callTool({
        name: "upsert_dns_record",
        arguments: { domain_id: 42, host: "www", type: "A", data: "203.0.113.10", ttl: 600 },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        action: "updated",
        record: { id: 5, data: "203.0.113.10", ttl: 600 },
      });
      expect(harness.apiServer.requests.some((r) => r.method === "POST")).toBe(false);
      expect(zone.records.size).toBe(1);
    });
  });

  it("keeps the stored ttl and priority when the update leaves them out", async () => {
    const zone = fakeZone([
      { id: 5, host: "@", type: "MX", data: "mx1.example.com", ttl: 7200, priority: 10 },
    ]);
    await withHarness(zone.handler, async (harness) => {
      const result = await harness.client.callTool({
        name: "upsert_dns_record",
        arguments: { domain_id: 42, host: "@", type: "MX", data: "mx2.example.com" },
      });

      expect(result.isError).not.toBe(true);
      const put = harness.apiServer.requests.find((r) => r.method === "PUT");
      expect(JSON.parse(put?.body ?? "{}")).toEqual({
        host: "@",
        type: "MX",
        data: "mx2.example.com",
        ttl: 7200,
        priority: 10,
      });
    });
  });

  it("still requires priority when creating an MX record", async () => {
    await withHarness(fakeZone([]).handler, async (harness) => {
      const result = await harness.client.callTool({
        name: "upsert_dns_record",
        arguments: { domain_id: 42, host: "@", type: "MX", data: "mx1.example.com" },
      });

      expect(result.isError).toBe(true);
      expect(resultText(result)).toContain("missing: priority");
      expect(harness.apiServer.requests.some((r) => r.method === "POST")).toBe(false);
    });
  });

  it("refuses to guess when the host has several records of that type", async () => {
    const zone = fakeZone([
      { id: 1, host: "@", type: "TXT", data: "v=spf1 -all" },
      { id: 2, host: "@", type: "TXT", data: "google-site-verification=abc" },
    ]);
    await withHarness(zone.handler, async (harness) => {
      const result = await harness.client.callTool({
        name: "upsert_dns_record",
        arguments: { domain_id: 42, host: "@", type: "TXT", data: "v=spf1 include:x -all" },
      });

      expect(result.isError).toBe(true);
      expect(resultText(result)).toContain("IDs 1, 2");
      expect(resultText(result)).toContain("patch_dns_record");
      expect(harness.apiServer.requests.every((r) => r.method === "GET")).toBe(true);
    });
  });
});
