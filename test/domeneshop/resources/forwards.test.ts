import { startTestServer, type TestServer } from "#testing/testServer.js";
import { describe, expect, it } from "vitest";
import { HttpTransport } from "#domeneshop/http.js";
import { ForwardsResource } from "#domeneshop/resources/forwards.js";

async function withResource(
  handler: Parameters<typeof startTestServer>[0],
  run: (resource: ForwardsResource, server: TestServer) => Promise<void>,
): Promise<void> {
  const server = await startTestServer(handler);
  try {
    const transport = new HttpTransport("token", "secret", server.baseUrl);
    await run(new ForwardsResource(transport), server);
  } finally {
    await server.close();
  }
}

describe("ForwardsResource", () => {
  it("reads the host from the Location header on create", async () => {
    await withResource(
      (_req, res) => {
        res.writeHead(201, { Location: "/domains/42/forwards/www" });
        res.end();
      },
      async (forwards) => {
        const forward = await forwards.create(42, {
          host: "www",
          url: "https://example.com",
          frame: false,
        });
        expect(forward).toEqual({ host: "www", url: "https://example.com", frame: false });
      },
    );
  });

  it("falls back to the submitted forward when there is no Location header", async () => {
    await withResource(
      (_req, res) => {
        res.writeHead(201);
        res.end();
      },
      async (forwards) => {
        const forward = await forwards.create(42, {
          host: "shop",
          url: "https://example.com/shop",
          frame: true,
        });
        expect(forward).toEqual({ host: "shop", url: "https://example.com/shop", frame: true });
      },
    );
  });

  it("escapes the host segment in the forward path", async () => {
    await withResource(
      (_req, res) => {
        res.writeHead(204);
        res.end();
      },
      async (forwards, server) => {
        await forwards.delete(42, "@");
        expect(server.requests[0]?.url).toBe("/domains/42/forwards/%40");

        await forwards.delete(42, "a b");
        expect(server.requests[1]?.url).toBe("/domains/42/forwards/a%20b");
      },
    );
  });
});
