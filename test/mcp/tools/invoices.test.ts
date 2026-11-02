import { describe, expect, it } from "vitest";
import { resultText, withHarness } from "#testing/mcpHarness.js";
import { sendJson } from "#testing/testServer.js";

describe("invoice tools", () => {
  it("lists invoices filtered by status, with structured content", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 200, [{ id: 1, status: "unpaid", amount: 250 }]);
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "list_invoices",
          arguments: { status: "unpaid" },
        });

        expect(result.isError).not.toBe(true);
        expect(harness.apiServer.requests[0]?.url).toBe("/invoices?status=unpaid");
        expect(result.structuredContent).toEqual({
          invoices: [{ id: 1, status: "unpaid", amount: 250 }],
        });
      },
    );
  });

  it("gets a single invoice", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 200, { id: 99, status: "paid", amount: 100 });
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "get_invoice",
          arguments: { invoice_id: 99 },
        });

        expect(result.isError).not.toBe(true);
        expect(resultText(result)).toContain("paid");
        expect(harness.apiServer.requests[0]?.url).toBe("/invoices/99");
      },
    );
  });
});
