import { describe, expect, it } from "vitest";
import { DomeneshopApiError, HttpTransport } from "#domeneshop/http.js";
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

  it("formats the error message with status and body", () => {
    const error = new DomeneshopApiError(500, "boom");
    expect(error.message).toBe("domeneshop: unexpected status 500: boom");
  });

  it("formats the error message without a body", () => {
    const error = new DomeneshopApiError(500, "");
    expect(error.message).toBe("domeneshop: unexpected status 500");
  });
});
