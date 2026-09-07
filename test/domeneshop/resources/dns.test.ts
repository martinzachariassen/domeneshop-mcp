import { sendJson, startTestServer, type TestServer } from "#testing/testServer.js";
import { describe, expect, it } from "vitest";
import { HttpTransport } from "#domeneshop/http.js";
import { DnsResource, RECORD_TYPES } from "#domeneshop/resources/dns.js";

async function withResource(
  handler: Parameters<typeof startTestServer>[0],
  run: (resource: DnsResource, server: TestServer) => Promise<void>,
): Promise<void> {
  const server = await startTestServer(handler);
  try {
    const transport = new HttpTransport("token", "secret", server.baseUrl);
    await run(new DnsResource(transport), server);
  } finally {
    await server.close();
  }
}

describe("RECORD_TYPES", () => {
  it("covers every Domeneshop-supported type, in schema order", () => {
    expect(RECORD_TYPES).toEqual([
      "A",
      "AAAA",
      "ANAME",
      "CAA",
      "CNAME",
      "DS",
      "MX",
      "NS",
      "SRV",
      "TLSA",
      "TXT",
    ]);
  });
});

describe("DnsResource", () => {
  it("preserves type-specific fields for every record type on list", async () => {
    const body = [
      { id: 1, host: "@", ttl: 3600, type: "MX", data: "mx.example.com", priority: 10 },
      {
        id: 2,
        host: "_sip._tcp",
        type: "SRV",
        data: "sip.example.com",
        priority: 10,
        weight: 100,
        port: 5060,
      },
      { id: 3, host: "@", type: "TLSA", data: "ABCD", usage: 3, selector: 1, dtype: 1 },
      { id: 4, host: "@", type: "DS", data: "ABCD", tag: 12345, alg: 13, digest: 2 },
      { id: 5, host: "@", type: "CAA", data: "letsencrypt.org", flags: 0, tag: "issue" },
      { id: 6, host: "@", type: "ANAME", data: "example.com" },
      { id: 7, host: "sub", type: "NS", data: "ns1.example.com" },
    ];

    await withResource(
      (_req, res) => {
        sendJson(res, 200, body);
      },
      async (dns) => {
        const records = await dns.list(1);
        expect(records).toHaveLength(7);

        const byType = new Map(records.map((r) => [r.type, r]));
        expect(byType.get("MX")?.priority).toBe(10);
        expect(byType.get("SRV")).toMatchObject({ weight: 100, port: 5060 });
        expect(byType.get("TLSA")).toMatchObject({ usage: 3, selector: 1, dtype: 1 });
        expect(byType.get("DS")).toMatchObject({ alg: 13, digest: 2, tag: 12345 });
        // A CAA tag arrives as a string; the loosely typed field must keep it as one.
        expect(byType.get("CAA")).toMatchObject({ flags: 0, tag: "issue" });
      },
    );
  });

  it("omits unset type-specific fields when creating a record", async () => {
    let received: Record<string, unknown> = {};
    await withResource(
      (_req, res, body) => {
        received = JSON.parse(body) as Record<string, unknown>;
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: 7 }));
      },
      async (dns) => {
        const id = await dns.create(1, { host: "www", type: "A", data: "192.0.2.1" });
        expect(id).toBe(7);
        expect(received).toEqual({ host: "www", type: "A", data: "192.0.2.1" });
      },
    );
  });

  it("sends type-specific fields when set, even a falsy 0", async () => {
    let received: Record<string, unknown> = {};
    await withResource(
      (_req, res, body) => {
        received = JSON.parse(body) as Record<string, unknown>;
        sendJson(res, 200, { id: 1 });
      },
      async (dns) => {
        await dns.create(1, {
          host: "@",
          type: "CAA",
          data: "letsencrypt.org",
          ttl: 3600,
          flags: 0,
          tag: "issue",
        });
        expect(received["flags"]).toBe(0);
        expect(received["tag"]).toBe("issue");
        expect(received["ttl"]).toBe(3600);
      },
    );
  });

  it("puts the record ID in the path, not the body, when updating", async () => {
    let path = "";
    let method = "";
    let received: Record<string, unknown> = {};
    await withResource(
      (req, res, body) => {
        path = req.url ?? "";
        method = req.method ?? "";
        received = JSON.parse(body) as Record<string, unknown>;
        res.writeHead(204);
        res.end();
      },
      async (dns) => {
        await dns.update(42, 7, { host: "www", type: "A", data: "192.0.2.2" });
        expect(method).toBe("PUT");
        expect(path).toBe("/domains/42/dns/7");
        expect(received).not.toHaveProperty("id");
      },
    );
  });
});
