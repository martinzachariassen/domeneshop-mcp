import { describe, expect, it } from "vitest";
import { withHarness } from "#testing/mcpHarness.js";

describe("cancellation", () => {
  it("aborts the API request when the MCP client cancels the call", async () => {
    let received = 0;
    await withHarness(
      () => {
        received++;
        // never respond: only cancellation can end this call
      },
      async (harness) => {
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
        expect(received).toBe(1);
      },
    );
  });
});
