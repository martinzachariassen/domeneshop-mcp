import { describe, expect, it } from "vitest";
import { resultText, withHarness } from "#testing/mcpHarness.js";
import { sendJson } from "#testing/testServer.js";

describe("domain tools", () => {
  it("lists domains", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 200, [{ id: 1, domain: "example.com" }]);
      },
      async (harness) => {
        const result = await harness.client.callTool({ name: "list_domains", arguments: {} });

        expect(result.isError).not.toBe(true);
        expect(resultText(result)).toContain("example.com");
        expect(harness.apiServer.requests[0]?.url).toBe("/domains");
      },
    );
  });

  it("gets a single domain", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 200, { id: 42, domain: "example.com" });
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "get_domain",
          arguments: { domain_id: 42 },
        });

        expect(result.isError).not.toBe(true);
        expect(resultText(result)).toContain("example.com");
        expect(harness.apiServer.requests[0]?.url).toBe("/domains/42");
      },
    );
  });
});
