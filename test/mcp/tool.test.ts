import { describe, expect, it } from "vitest";
import { withHarness } from "#testing/mcpHarness.js";
import { neverRespond } from "#testing/testServer.js";

describe("cancellation", () => {
  it("aborts the API request when the MCP client cancels the call", async () => {
    await withHarness(neverRespond, async (harness) => {
      const controller = new AbortController();
      const pending = harness.client.callTool(
        { name: "list_domains", arguments: {} },
        {
          signal: controller.signal,
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      controller.abort();

      await expect(pending).rejects.toThrow();
      expect(harness.apiServer.requests).toHaveLength(1);
    });
  });
});
