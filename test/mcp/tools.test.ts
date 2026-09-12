import { describe, expect, it } from "vitest";
import { connect, resultText } from "#testing/mcpHarness.js";

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
    const harness = await connect((_req, res, body) => {
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
});

describe("invoice tools", () => {
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
});
