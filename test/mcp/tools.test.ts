import { describe, expect, it } from "vitest";
import { connect, resultText } from "#testing/mcpHarness.js";
import { sendJson } from "#testing/testServer.js";

describe("domain tools", () => {
  it("lists domains", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([{ id: 1, domain: "example.com" }]));
    });
    try {
      const result = await harness.client.callTool({ name: "list_domains", arguments: {} });

      expect(result.isError).not.toBe(true);
      expect(resultText(result)).toContain("example.com");
      expect(harness.apiServer.requests[0]?.url).toBe("/domains");
    } finally {
      await harness.close();
    }
  });

  it("gets a single domain", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: 42, domain: "example.com" }));
    });
    try {
      const result = await harness.client.callTool({
        name: "get_domain",
        arguments: { domain_id: 42 },
      });

      expect(result.isError).not.toBe(true);
      expect(resultText(result)).toContain("example.com");
      expect(harness.apiServer.requests[0]?.url).toBe("/domains/42");
    } finally {
      await harness.close();
    }
  });
});

describe("dns record tools", () => {
  it("lists DNS records for a domain", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([{ id: 1, host: "www", type: "A", data: "1.2.3.4" }]));
    });
    try {
      const result = await harness.client.callTool({
        name: "list_dns_records",
        arguments: { domain_id: 42 },
      });

      expect(result.isError).not.toBe(true);
      expect(resultText(result)).toContain("1.2.3.4");
      expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/dns");
    } finally {
      await harness.close();
    }
  });

  it("gets a single DNS record", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: 7, host: "www", type: "A", data: "1.2.3.4" }));
    });
    try {
      const result = await harness.client.callTool({
        name: "get_dns_record",
        arguments: { domain_id: 42, record_id: 7 },
      });

      expect(result.isError).not.toBe(true);
      expect(resultText(result)).toContain("1.2.3.4");
      expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/dns/7");
    } finally {
      await harness.close();
    }
  });

  it("updates a DNS record, sending every field through to the API", async () => {
    let received: Record<string, unknown> = {};
    const harness = await connect((req, res, body) => {
      if (req.method === "GET") {
        sendJson(res, 200, { id: 7, ...received });
        return;
      }
      received = JSON.parse(body) as Record<string, unknown>;
      res.writeHead(204);
      res.end();
    });
    try {
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
    } finally {
      await harness.close();
    }
  });

  it("returns the record that was sent when the read-back after a write fails", async () => {
    const harness = await connect((req, res) => {
      if (req.method === "GET") {
        res.writeHead(500);
        res.end();
        return;
      }
      res.writeHead(204);
      res.end();
    });
    try {
      const result = await harness.client.callTool({
        name: "update_dns_record",
        arguments: { domain_id: 42, record_id: 7, host: "www", type: "A", data: "5.6.7.8" },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ id: 7, data: "5.6.7.8" });
    } finally {
      await harness.close();
    }
  });

  it("rejects an MX record without priority before calling the API", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(201);
      res.end();
    });
    try {
      const result = await harness.client.callTool({
        name: "create_dns_record",
        arguments: { domain_id: 42, host: "@", type: "MX", data: "mx.example.com" },
      });

      expect(result.isError).toBe(true);
      expect(resultText(result)).toBe("MX records require priority; missing: priority");
      expect(harness.apiServer.requests).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  it.each([
    ["ttl not a multiple of 60", { ttl: 90 }],
    ["ttl below the minimum", { ttl: 30 }],
    ["ttl above the maximum", { ttl: 604860 }],
  ])("rejects %s", async (_label, extra) => {
    const harness = await connect((_req, res) => {
      res.writeHead(201);
      res.end();
    });
    try {
      const result = await harness.client.callTool({
        name: "create_dns_record",
        arguments: { domain_id: 42, host: "www", type: "A", data: "1.2.3.4", ...extra },
      });

      expect(result.isError).toBe(true);
      expect(harness.apiServer.requests).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  it("deletes a DNS record", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(204);
      res.end();
    });
    try {
      const result = await harness.client.callTool({
        name: "delete_dns_record",
        arguments: { domain_id: 42, record_id: 7 },
      });

      expect(result.isError).not.toBe(true);
      expect(harness.apiServer.requests[0]?.method).toBe("DELETE");
      expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/dns/7");
    } finally {
      await harness.close();
    }
  });
});

describe("forward tools", () => {
  it("lists forwards for a domain", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([{ host: "www", url: "https://example.com", frame: false }]));
    });
    try {
      const result = await harness.client.callTool({
        name: "list_forwards",
        arguments: { domain_id: 42 },
      });

      expect(result.isError).not.toBe(true);
      expect(resultText(result)).toContain("https://example.com");
      expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/forwards/");
    } finally {
      await harness.close();
    }
  });

  it("gets the forward for a specific host", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ host: "www", url: "https://example.com", frame: false }));
    });
    try {
      const result = await harness.client.callTool({
        name: "get_forward",
        arguments: { domain_id: 42, host: "www" },
      });

      expect(result.isError).not.toBe(true);
      expect(resultText(result)).toContain("https://example.com");
      expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/forwards/www");
    } finally {
      await harness.close();
    }
  });

  it("updates a forward", async () => {
    let received: Record<string, unknown> = {};
    const harness = await connect((_req, res, body) => {
      received = JSON.parse(body) as Record<string, unknown>;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ host: "www", url: "https://updated.example.com", frame: true }));
    });
    try {
      const result = await harness.client.callTool({
        name: "update_forward",
        arguments: { domain_id: 42, host: "www", url: "https://updated.example.com", frame: true },
      });

      expect(result.isError).not.toBe(true);
      expect(harness.apiServer.requests[0]?.method).toBe("PUT");
      expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/forwards/www");
      expect(received["frame"]).toBe(true);
      expect(resultText(result)).toContain("updated.example.com");
    } finally {
      await harness.close();
    }
  });

  it("deletes a forward", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(204);
      res.end();
    });
    try {
      const result = await harness.client.callTool({
        name: "delete_forward",
        arguments: { domain_id: 42, host: "www" },
      });

      expect(result.isError).not.toBe(true);
      expect(harness.apiServer.requests[0]?.method).toBe("DELETE");
      expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/forwards/www");
    } finally {
      await harness.close();
    }
  });

  it("rejects a forward URL that is not http or https", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(201);
      res.end();
    });
    try {
      const result = await harness.client.callTool({
        name: "create_forward",
        arguments: { domain_id: 42, host: "www", url: "ftp://example.com" },
      });

      expect(result.isError).toBe(true);
      expect(harness.apiServer.requests).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });
});

describe("invoice tools", () => {
  it("lists invoices filtered by status, with structured content", async () => {
    const harness = await connect((_req, res) => {
      sendJson(res, 200, [{ id: 1, status: "unpaid", amount: 250 }]);
    });
    try {
      const result = await harness.client.callTool({
        name: "list_invoices",
        arguments: { status: "unpaid" },
      });

      expect(result.isError).not.toBe(true);
      expect(harness.apiServer.requests[0]?.url).toBe("/invoices?status=unpaid");
      expect(result.structuredContent).toEqual({
        invoices: [{ id: 1, status: "unpaid", amount: 250 }],
      });
    } finally {
      await harness.close();
    }
  });

  it("gets a single invoice", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: 99, status: "paid", amount: 100 }));
    });
    try {
      const result = await harness.client.callTool({
        name: "get_invoice",
        arguments: { invoice_id: 99 },
      });

      expect(result.isError).not.toBe(true);
      expect(resultText(result)).toContain("paid");
      expect(harness.apiServer.requests[0]?.url).toBe("/invoices/99");
    } finally {
      await harness.close();
    }
  });
});

describe("dynamic DNS tools", () => {
  it("updates a dynamic DNS hostname with an explicit IP", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("good");
    });
    try {
      const result = await harness.client.callTool({
        name: "update_dyndns",
        arguments: { hostname: "home.example.com", myip: "1.2.3.4" },
      });

      expect(result.isError).not.toBe(true);
      expect(resultText(result)).toContain("updated");
      const request = harness.apiServer.requests[0];
      expect(request?.url).toBe("/dyndns/update?hostname=home.example.com&myip=1.2.3.4");
    } finally {
      await harness.close();
    }
  });

  it("omits myip when not provided, letting Domeneshop infer the caller's IP", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("good");
    });
    try {
      const result = await harness.client.callTool({
        name: "update_dyndns",
        arguments: { hostname: "home.example.com" },
      });

      expect(result.isError).not.toBe(true);
      expect(harness.apiServer.requests[0]?.url).toBe("/dyndns/update?hostname=home.example.com");
    } finally {
      await harness.close();
    }
  });

  it("accepts a comma-separated IPv4 and IPv6 list", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(204);
      res.end();
    });
    try {
      const result = await harness.client.callTool({
        name: "update_dyndns",
        arguments: { hostname: "home.example.com", myip: "192.0.2.1,2001:db8::1" },
      });

      expect(result.isError).not.toBe(true);
      expect(harness.apiServer.requests[0]?.url).toBe(
        "/dyndns/update?hostname=home.example.com&myip=192.0.2.1%2C2001%3Adb8%3A%3A1",
      );
    } finally {
      await harness.close();
    }
  });

  it("rejects a myip that is not an IP address", async () => {
    const harness = await connect((_req, res) => {
      res.writeHead(204);
      res.end();
    });
    try {
      const result = await harness.client.callTool({
        name: "update_dyndns",
        arguments: { hostname: "home.example.com", myip: "not-an-ip" },
      });

      expect(result.isError).toBe(true);
      expect(harness.apiServer.requests).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });
});

describe("cancellation", () => {
  it("aborts the API request when the MCP client cancels the call", async () => {
    let received = 0;
    const harness = await connect(() => {
      received++;
      // never respond: only cancellation can end this call
    });
    try {
      const controller = new AbortController();
      const pending = harness.client.callTool({ name: "list_domains", arguments: {} }, undefined, {
        signal: controller.signal,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      controller.abort();

      await expect(pending).rejects.toThrow();
      expect(received).toBe(1);
    } finally {
      await harness.close();
    }
  });
});
