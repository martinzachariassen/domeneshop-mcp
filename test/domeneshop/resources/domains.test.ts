import { describe, expect, it } from "vitest";
import { HttpTransport } from "#domeneshop/http.js";
import { DomainsResource } from "#domeneshop/resources/domains.js";
import { type Handler, sendJson, type TestServer, withTestServer } from "#testing/testServer.js";

function withResource(
  handler: Handler,
  run: (resource: DomainsResource, server: TestServer) => Promise<void>,
): Promise<void> {
  return withTestServer(handler, (server) =>
    run(
      new DomainsResource(new HttpTransport("token", "secret", { baseUrl: server.baseUrl })),
      server,
    ),
  );
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
