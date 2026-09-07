import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { readOnly } from "../annotations.js";
import { jsonResult } from "../result.js";
import type { InferShape } from "../schema.js";
import { toolHandler } from "../tool.js";

const listInvoicesShape = {
  status: z
    .string()
    .optional()
    .describe("only return invoices with this status: unpaid, paid or settled"),
};
type ListInvoicesArgs = InferShape<typeof listInvoicesShape>;

const getInvoiceShape = {
  invoice_id: z.number().int().describe("the invoice ID, from list_invoices"),
};
type GetInvoiceArgs = InferShape<typeof getInvoiceShape>;

export function registerInvoiceTools(server: McpServer, client: DomeneshopClient): void {
  server.registerTool(
    "list_invoices",
    {
      description:
        "List invoices from the past three years on the Domeneshop account, optionally filtered by status.",
      inputSchema: listInvoicesShape,
      annotations: readOnly(),
    },
    toolHandler<ListInvoicesArgs>(async ({ status }) => {
      const invoices = await client.invoices.list(status);
      return jsonResult(invoices);
    }),
  );

  server.registerTool(
    "get_invoice",
    {
      description: "Get details for a single invoice.",
      inputSchema: getInvoiceShape,
      annotations: readOnly(),
    },
    toolHandler<GetInvoiceArgs>(async ({ invoice_id }) => {
      const invoice = await client.invoices.get(invoice_id);
      return jsonResult(invoice);
    }),
  );
}
