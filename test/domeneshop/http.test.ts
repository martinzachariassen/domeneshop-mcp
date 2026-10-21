import { describe, expect, it } from "vitest";
import {
  DomeneshopApiError,
  DomeneshopNetworkError,
  HttpTransport,
  parseRetryAfter,
  type RequestEvent,
} from "#domeneshop/http.js";
import { sendJson, startTestServer, type TestServer } from "#testing/testServer.js";

async function withServer(
  handler: Parameters<typeof startTestServer>[0],
  run: (server: TestServer) => Promise<void>,
): Promise<void> {
  const server = await startTestServer(handler);
  try {
    await run(server);
  } finally {
    await server.close();
  }
}

describe("HttpTransport", () => {
  it("sends HTTP Basic Auth credentials", async () => {
    await withServer(
      (_req, res) => {
        sendJson(res, 200, { ok: true });
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", server.baseUrl);
        await transport.request("GET", "/ping");

        const expected = `Basic ${Buffer.from("token:secret").toString("base64")}`;
        expect(server.requests[0]?.authorization).toBe(expected);
      },
    );
  });

  it("omits undefined and empty-string query parameters", async () => {
    await withServer(
      (_req, res) => {
        sendJson(res, 200, {});
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", server.baseUrl);
        await transport.request("GET", "/things", {
          query: { present: "value", missing: undefined, empty: "" },
        });

        expect(server.requests[0]?.url).toBe("/things?present=value");
      },
    );
  });

  it("marshals the request body as JSON and sets Content-Type", async () => {
    await withServer(
      (_req, res) => {
        sendJson(res, 200, {});
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", server.baseUrl);
        await transport.request("POST", "/things", { body: { name: "example" } });

        expect(server.requests[0]?.body).toBe(JSON.stringify({ name: "example" }));
      },
    );
  });

  it("returns parsed JSON data and response headers", async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(201, { "Content-Type": "application/json", Location: "/things/42" });
        res.end(JSON.stringify({ id: 42 }));
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", server.baseUrl);
        const { data, headers } = await transport.request<{ id: number }>("POST", "/things");

        expect(data).toEqual({ id: 42 });
        expect(headers.get("Location")).toBe("/things/42");
      },
    );
  });

  it("returns undefined data for an empty response body", async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(204);
        res.end();
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", server.baseUrl);
        const { data } = await transport.request("DELETE", "/things/1");

        expect(data).toBeUndefined();
      },
    );
  });

  it("throws DomeneshopApiError for non-2xx responses", async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "not found" }));
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", server.baseUrl);

        await expect(transport.request("GET", "/missing")).rejects.toMatchObject({
          statusCode: 404,
          body: JSON.stringify({ message: "not found" }),
        });
        await expect(transport.request("GET", "/missing")).rejects.toBeInstanceOf(
          DomeneshopApiError,
        );
      },
    );
  });

  it("formats the error message with status, detail and hint", () => {
    const error = new DomeneshopApiError(500, "boom");
    expect(error.message).toBe(
      "domeneshop: API returned status 500: boom. The Domeneshop API had an internal error; try again later.",
    );
  });

  it("formats the error message without a body", () => {
    const error = new DomeneshopApiError(418, "");
    expect(error.message).toBe("domeneshop: API returned status 418");
    expect(error.hint).toBeUndefined();
  });

  it.each([
    [401, "DOMENESHOP_API_TOKEN"],
    [403, "lack permission"],
    [404, "list_* tools"],
    [409, "Conflict"],
    [429, "Rate limited"],
  ])("adds a hint for status %i", (status, fragment) => {
    const error = new DomeneshopApiError(status, "");
    expect(error.hint).toContain(fragment);
    expect(error.message).toContain(fragment);
  });

  it("extracts the message fields from a JSON error body", () => {
    const error = new DomeneshopApiError(
      400,
      JSON.stringify({ code: "dns:invalidTtl", help: "TTL must be a multiple of 60" }),
    );
    expect(error.message).toContain("dns:invalidTtl — TTL must be a multiple of 60");
  });

  it("strips HTML and truncates long error bodies", () => {
    const html = `<!DOCTYPE html><html><head><style>p{}</style></head><body><h1>Bad Gateway</h1><p>${"x".repeat(1000)}</p></body></html>`;
    const error = new DomeneshopApiError(502, html);
    expect(error.message).toContain("Bad Gateway");
    expect(error.message).not.toContain("<h1>");
    expect(error.message).not.toContain("p{}");
    expect(error.message).toContain("…");
    expect(error.message.length).toBeLessThan(700);
  });

  it("sends a User-Agent identifying the server", async () => {
    await withServer(
      (_req, res) => {
        sendJson(res, 200, {});
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", server.baseUrl);
        await transport.request("GET", "/ping");
        expect(server.requests[0]?.userAgent).toMatch(/^domeneshop-mcp\/\d+\.\d+\.\d+/);
      },
    );
  });

  it("reports invalid JSON in a successful response clearly", async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{not json");
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", server.baseUrl);
        await expect(transport.request("GET", "/broken")).rejects.toThrow(
          "GET /broken returned status 200 with a body that is not valid JSON: {not json",
        );
      },
    );
  });

  it("retries 429 responses on GET, honouring Retry-After", async () => {
    let calls = 0;
    await withServer(
      (_req, res) => {
        calls++;
        if (calls === 1) {
          res.writeHead(429, { "Retry-After": "0" });
          res.end();
          return;
        }
        sendJson(res, 200, { ok: true });
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", { baseUrl: server.baseUrl });
        const { data } = await transport.request("GET", "/limited");
        expect(data).toEqual({ ok: true });
        expect(server.requests).toHaveLength(2);
      },
    );
  });

  it("retries 503 responses with backoff and gives up after maxRetries", async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(503);
        res.end("unavailable");
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", {
          baseUrl: server.baseUrl,
          maxRetries: 2,
          retryBaseDelayMs: 1,
        });
        await expect(transport.request("GET", "/down")).rejects.toMatchObject({ statusCode: 503 });
        expect(server.requests).toHaveLength(3);
      },
    );
  });

  it("never retries POST, since a create may already have happened", async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(503);
        res.end();
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", {
          baseUrl: server.baseUrl,
          retryBaseDelayMs: 1,
        });
        await expect(transport.request("POST", "/things", { body: {} })).rejects.toMatchObject({
          statusCode: 503,
        });
        expect(server.requests).toHaveLength(1);
      },
    );
  });

  it("does not retry other client errors", async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(400);
        res.end();
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", { baseUrl: server.baseUrl });
        await expect(transport.request("GET", "/bad")).rejects.toMatchObject({ statusCode: 400 });
        expect(server.requests).toHaveLength(1);
      },
    );
  });

  it("times out a request that never answers", async () => {
    await withServer(
      () => {
        // never respond
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", {
          baseUrl: server.baseUrl,
          timeoutMs: 50,
          maxRetries: 0,
        });
        const error = await transport.request("GET", "/slow").catch((e: unknown) => e);
        expect(error).toBeInstanceOf(DomeneshopNetworkError);
        expect((error as Error).message).toBe("domeneshop: GET /slow timed out after 50 ms");
      },
    );
  });

  it("wraps connection failures in DomeneshopNetworkError", async () => {
    const server = await startTestServer(() => undefined);
    const baseUrl = server.baseUrl;
    await server.close();

    const transport = new HttpTransport("token", "secret", { baseUrl, maxRetries: 0 });
    const error = await transport.request("GET", "/gone").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DomeneshopNetworkError);
    expect((error as Error).message).toContain("GET /gone failed before a response was received");
  });

  it("warns that a timed-out POST may still have been applied", async () => {
    await withServer(
      () => {
        // never respond
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", {
          baseUrl: server.baseUrl,
          timeoutMs: 50,
        });
        const error = await transport.request("POST", "/things").catch((e: unknown) => e);
        expect(error).toBeInstanceOf(DomeneshopNetworkError);
        expect((error as Error).message).toContain("timed out after 50 ms");
        expect((error as Error).message).toContain("may still have been applied");
        expect(server.requests).toHaveLength(1);
      },
    );
  });

  it("treats a 404 on a retried DELETE as success when the first attempt was lost", async () => {
    let calls = 0;
    await withServer(
      (req, res) => {
        calls++;
        if (calls === 1) {
          // The server got the DELETE but the connection dies before a response.
          req.socket.destroy();
          return;
        }
        res.writeHead(404);
        res.end();
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", {
          baseUrl: server.baseUrl,
          retryBaseDelayMs: 1,
        });
        await expect(transport.request("DELETE", "/things/1")).resolves.toMatchObject({
          data: undefined,
        });
        expect(server.requests).toHaveLength(2);
      },
    );
  });

  it("still reports a 404 on a DELETE whose first attempt got a response", async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(404);
        res.end();
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", { baseUrl: server.baseUrl });
        await expect(transport.request("DELETE", "/things/1")).rejects.toMatchObject({
          statusCode: 404,
        });
      },
    );
  });

  it("aborts an in-flight request when the caller's signal fires", async () => {
    await withServer(
      () => {
        // never respond
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", { baseUrl: server.baseUrl });
        const controller = new AbortController();
        const pending = transport.request("GET", "/slow", { signal: controller.signal });
        controller.abort(new Error("cancelled by client"));
        await expect(pending).rejects.toThrow("cancelled by client");
      },
    );
  });

  it("aborts a pending retry wait when the caller's signal fires", async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(429, { "Retry-After": "10" });
        res.end();
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", { baseUrl: server.baseUrl });
        const controller = new AbortController();
        const pending = transport.request("GET", "/limited", { signal: controller.signal });
        setTimeout(() => controller.abort(new Error("cancelled")), 50);
        await expect(pending).rejects.toThrow("cancelled");
        expect(server.requests).toHaveLength(1);
      },
    );
  });

  it("reports each attempt to onResponse without credentials", async () => {
    const events: RequestEvent[] = [];
    await withServer(
      (_req, res) => {
        sendJson(res, 200, {});
      },
      async (server) => {
        const transport = new HttpTransport("token", "secret", {
          baseUrl: server.baseUrl,
          onResponse: (event) => events.push(event),
        });
        await transport.request("GET", "/ping");
        expect(events).toEqual([
          { method: "GET", path: "/ping", status: 200, durationMs: expect.any(Number), attempt: 1 },
        ]);
      },
    );
  });
});

describe("parseRetryAfter", () => {
  it("parses delta-seconds and HTTP dates", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("soon")).toBeUndefined();
    const inFuture = new Date(Date.now() + 5000).toUTCString();
    expect(parseRetryAfter(inFuture)).toBeGreaterThan(3000);
  });
});
