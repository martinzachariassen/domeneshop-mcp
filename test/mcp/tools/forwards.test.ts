import { describe, expect, it } from "vitest";
import { resultText, withHarness } from "#testing/mcpHarness.js";
import { sendJson } from "#testing/testServer.js";

describe("forward tools", () => {
  it("lists forwards for a domain", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 200, [{ host: "www", url: "https://example.com", frame: false }]);
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "list_forwards",
          arguments: { domain_id: 42 },
        });

        expect(result.isError).not.toBe(true);
        expect(resultText(result)).toContain("https://example.com");
        expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/forwards/");
      },
    );
  });

  it("gets the forward for a specific host", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 200, { host: "www", url: "https://example.com", frame: false });
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "get_forward",
          arguments: { domain_id: 42, host: "www" },
        });

        expect(result.isError).not.toBe(true);
        expect(resultText(result)).toContain("https://example.com");
        expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/forwards/www");
      },
    );
  });

  it("updates a forward", async () => {
    let received: Record<string, unknown> = {};
    await withHarness(
      (_req, res, body) => {
        received = JSON.parse(body) as Record<string, unknown>;
        sendJson(res, 200, { host: "www", url: "https://updated.example.com", frame: true });
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_forward",
          arguments: {
            domain_id: 42,
            host: "www",
            url: "https://updated.example.com",
            frame: true,
          },
        });

        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests[0]?.method).toBe("PUT");
        expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/forwards/www");
        expect(received["frame"]).toBe(true);
        expect(resultText(result)).toContain("updated.example.com");
      },
    );
  });

  it.each<[string, Record<string, unknown>, boolean]>([
    ["keeps a stored frame", { host: "www", url: "https://example.com", frame: true }, true],
    ["defaults to false without one", { host: "www", url: "https://example.com" }, false],
  ])("updates a forward without frame: %s", async (_case, stored, expected) => {
    let received: Record<string, unknown> = {};
    await withHarness(
      (req, res, body) => {
        if (req.method === "GET") {
          sendJson(res, 200, stored);
          return;
        }
        received = JSON.parse(body) as Record<string, unknown>;
        sendJson(res, 200, { ...received });
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_forward",
          arguments: { domain_id: 42, host: "www", url: "https://updated.example.com" },
        });

        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests.map((r) => r.method)).toEqual(["GET", "PUT"]);
        expect(received).toEqual({
          host: "www",
          url: "https://updated.example.com",
          frame: expected,
        });
      },
    );
  });

  it("does not update a forward whose stored frame cannot be read", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 404, { code: "NotFound", help: "Forward not found" });
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "update_forward",
          arguments: { domain_id: 42, host: "www", url: "https://updated.example.com" },
        });

        expect(result.isError).toBe(true);
        expect(harness.apiServer.requests.map((r) => r.method)).toEqual(["GET"]);
      },
    );
  });

  it("deletes a forward", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(204);
        res.end();
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "delete_forward",
          arguments: { domain_id: 42, host: "www" },
        });

        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests[0]?.method).toBe("DELETE");
        expect(harness.apiServer.requests[0]?.url).toBe("/domains/42/forwards/www");
      },
    );
  });
});
