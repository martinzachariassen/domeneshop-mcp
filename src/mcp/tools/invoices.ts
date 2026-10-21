import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { INVOICE_STATUSES } from "../../domeneshop/index.js";
import { readOnly } from "../annotations.js";
import { invoiceOutput, optionalFilter } from "../fields.js";
import { jsonResult, listResult } from "../result.js";
import type { InferShape } from "../schema.js";
import { toolHandler } from "../tool.js";

const listInvoicesShape = {
  status: optionalFilter(INVOICE_STATUSES).describe(
    "only return invoices with this status; 'settled' applies only to credit notes",
  ),
};
type ListInvoicesArgs = InferShape<typeof listInvoicesShape>;

const getInvoiceShape = {
  invoice_id: z.number().int().positive().describe("the invoice ID, from list_invoices"),
};
type GetInvoiceArgs = InferShape<typeof getInvoiceShape>;

export function registerInvoiceTools(server: McpServer, client: DomeneshopClient): void {
  server.registerTool(
    "list_invoices",
    {
      description:
        "List invoices from the past three years on the Domeneshop account, optionally filtered by status.",
      inputSchema: listInvoicesShape,
      outputSchema: { invoices: z.array(invoiceOutput) },
      ...readOnly("List invoices"),
    },
    toolHandler<ListInvoicesArgs>(async ({ status }, { signal }) => {
      const invoices = await client.invoices.list(status, { signal });
      return listResult("invoices", invoices);
    }),
  );

  server.registerTool(
    "get_invoice",
    {
      description: "Get details for a single invoice, including a link to the PDF.",
      inputSchema: getInvoiceShape,
      outputSchema: invoiceOutput,
      ...readOnly("Get invoice"),
    },
    toolHandler<GetInvoiceArgs>(async ({ invoice_id }, { signal }) => {
      const invoice = await client.invoices.get(invoice_id, { signal });
      return jsonResult(invoice);
    }),
  );
}
