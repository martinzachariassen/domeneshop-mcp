import { describe, expect, it } from "vitest";
import { HttpTransport } from "#domeneshop/http.js";
import { ForwardsResource } from "#domeneshop/resources/forwards.js";
import { type Handler, type TestServer, withTestServer } from "#testing/testServer.js";

function withResource(
  handler: Handler,
  run: (resource: ForwardsResource, server: TestServer) => Promise<void>,
): Promise<void> {
  return withTestServer(handler, (server) =>
    run(
      new ForwardsResource(new HttpTransport("token", "secret", { baseUrl: server.baseUrl })),
      server,
    ),
  );
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

  it.each([
    ["no Location header", {}, "www"],
    ["an undecodable Location", { Location: "/domains/42/forwards/%E0%A4%A" }, "%E0%A4%A"],
    ["an encoded Location", { Location: "/domains/42/forwards/%40" }, "@"],
    ["a Location ending in a slash", { Location: "/domains/42/forwards/" }, "www"],
  ])("handles %s on create", async (_label, headers, host) => {
    await withResource(
      (_req, res) => {
        res.writeHead(201, headers);
        res.end();
      },
      async (forwards) => {
        const forward = await forwards.create(42, {
          host: "www",
          url: "https://example.com",
          frame: false,
        });
        expect(forward.host).toBe(host);
      },
    );
  });
});
