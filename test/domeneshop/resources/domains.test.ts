import { describe, expect, it } from "vitest";
import { HttpTransport } from "#domeneshop/http.js";
import { DomainsResource } from "#domeneshop/resources/domains.js";
import { sendJson, startTestServer, type TestServer } from "#testing/testServer.js";

async function withResource(
  handler: Parameters<typeof startTestServer>[0],
  run: (resource: DomainsResource, server: TestServer) => Promise<void>,
): Promise<void> {
  const server = await startTestServer(handler);
  try {
    const transport = new HttpTransport("token", "secret", server.baseUrl);
    await run(new DomainsResource(transport), server);
  } finally {
    await server.close();
  }
}

describe("DomainsResource", () => {
  it("lists domains without a filter", async () => {
    await withResource(
      (_req, res) => {
        sendJson(res, 200, [{ id: 1, domain: "example.com" }]);
      },
      async (domains, server) => {
        const result = await domains.list();
        expect(result).toEqual([{ id: 1, domain: "example.com" }]);
        expect(server.requests[0]?.url).toBe("/domains");
      },
    );
  });

  it("passes a filter as the domain query parameter", async () => {
    await withResource(
      (_req, res) => {
        sendJson(res, 200, []);
      },
      async (domains, server) => {
        await domains.list("example");
        expect(server.requests[0]?.url).toBe("/domains?domain=example");
      },
    );
  });

  it("gets a single domain by ID", async () => {
    await withResource(
      (_req, res) => {
        sendJson(res, 200, { id: 7, domain: "example.com" });
      },
      async (domains, server) => {
        const domain = await domains.get(7);
        expect(domain).toEqual({ id: 7, domain: "example.com" });
        expect(server.requests[0]?.url).toBe("/domains/7");
      },
    );
  });
});
