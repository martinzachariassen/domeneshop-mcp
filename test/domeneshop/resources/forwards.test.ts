import { describe, expect, it } from "vitest";
import { DomeneshopApiError, HttpTransport } from "#domeneshop/http.js";
import { type Forward, ForwardsResource } from "#domeneshop/resources/forwards.js";
import { type Handler, sendJson, type TestServer, withTestServer } from "#testing/testServer.js";

/**
 * Mimics the live API: per-host GET/PUT/DELETE answer 404 for a host with a
 * hyphen, and PUT answers 204 without a body.
 */
function liveApi(forwards: Forward[]): Handler {
  return (req, res) => {
    const match = /^\/domains\/1\/forwards\/(.*)$/.exec(req.url ?? "");
    const host = decodeURIComponent(match?.[1] ?? "");
    if (req.method === "GET" && host === "") {
      sendJson(res, 200, forwards);
      return;
    }
    const forward = host.includes("-") ? undefined : forwards.find((f) => f.host === host);
    if (!forward) {
      sendJson(res, 404, { code: "resource:unknown" });
      return;
    }
    if (req.method === "GET") {
      sendJson(res, 200, forward);
      return;
    }
    res.writeHead(204);
    res.end();
  };
}

const HYPHENATED: Forward = { host: "my-app", url: "https://example.com", frame: true };
const PLAIN: Forward = { host: "www", url: "https://example.com", frame: false };

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

  it("finds a forward through the list when the API cannot get it by host", async () => {
    await withResource(liveApi([HYPHENATED, PLAIN]), async (forwards, server) => {
      await expect(forwards.get(1, "My-App")).resolves.toEqual(HYPHENATED);
      expect(server.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
        "GET /domains/1/forwards/My-App",
        "GET /domains/1/forwards/",
      ]);
    });
  });

  it("gets a forward by host without listing when the API finds it", async () => {
    await withResource(liveApi([PLAIN]), async (forwards, server) => {
      await expect(forwards.get(1, "www")).resolves.toEqual(PLAIN);
      expect(server.requests).toHaveLength(1);
    });
  });

  it("keeps the 404 when the forward is not listed either", async () => {
    await withResource(liveApi([PLAIN]), async (forwards) => {
      await expect(forwards.get(1, "missing")).rejects.toMatchObject({
        statusCode: 404,
        hint: expect.stringContaining("Not found") as unknown,
      });
      await expect(forwards.delete(1, "missing")).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  it("returns the sent forward when an update answers 204 without a body", async () => {
    const changed = { ...PLAIN, url: "https://example.org" };
    await withResource(liveApi([PLAIN]), async (forwards) => {
      await expect(forwards.update(1, "www", changed)).resolves.toEqual(changed);
    });
  });

  it.each(["update", "delete"] as const)(
    "explains why it cannot %s a listed forward the API answers 404 for",
    async (action) => {
      await withResource(liveApi([HYPHENATED]), async (forwards) => {
        const error: unknown = await (action === "update"
          ? forwards.update(1, "my-app", HYPHENATED)
          : forwards.delete(1, "my-app")
        ).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(DomeneshopApiError);
        expect(error).toMatchObject({ statusCode: 404 });
        expect((error as Error).message).toContain("contains a hyphen");
        expect((error as Error).message).toContain("control panel");
      });
    },
  );

  it("does not blame the hyphen for a listed host without one", async () => {
    await withResource(
      (req, res) => {
        if (req.url?.endsWith("/forwards/")) {
          sendJson(res, 200, [PLAIN]);
          return;
        }
        sendJson(res, 404, { code: "resource:unknown" });
      },
      async (forwards) => {
        const error = await forwards.delete(1, "www").catch((e: unknown) => e);
        expect((error as Error).message).toContain("did not find it by host");
      },
    );
  });

  it("passes on errors other than 404 unchanged", async () => {
    await withResource(
      (_req, res) => {
        sendJson(res, 403, { code: "forbidden" });
      },
      async (forwards, server) => {
        await expect(forwards.get(1, "my-app")).rejects.toMatchObject({ statusCode: 403 });
        await expect(forwards.delete(1, "my-app")).rejects.toMatchObject({ statusCode: 403 });
        expect(server.requests).toHaveLength(2);
      },
    );
  });
});
