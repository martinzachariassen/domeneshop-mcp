import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { INVOICE_STATUSES } from "../../domeneshop/index.js";
import { readOnly } from "../annotations.js";
import { invoiceIdField, optionalFilter } from "../fields.js";
import { invoiceOutput } from "../outputs.js";
import type { ToolRegistrar } from "../registry.js";
import { jsonResult, listResult } from "../result.js";
import { toolHandler } from "../tool.js";

export function registerInvoiceTools(server: ToolRegistrar, client: DomeneshopClient): void {
  server.registerTool(
    "list_invoices",
    {
      description:
        "List invoices from the past three years on the Domeneshop account, optionally filtered by status.",
      inputSchema: z.object({
        status: optionalFilter(INVOICE_STATUSES).describe(
          "only return invoices with this status; 'settled' applies only to credit notes",
        ),
      }),
      outputSchema: z.object({ invoices: z.array(invoiceOutput) }),
      ...readOnly("List invoices"),
    },
    toolHandler(async ({ status }, { signal }) => {
      const invoices = await client.invoices.list(status, { signal });
      return listResult("invoices", invoices);
    }),
  );

  server.registerTool(
    "get_invoice",
    {
      description: "Get details for a single invoice, including a link to the PDF.",
      inputSchema: z.object({ invoice_id: invoiceIdField }),
      outputSchema: invoiceOutput,
      ...readOnly("Get invoice"),
    },
    toolHandler(async ({ invoice_id }, { signal }) => {
      const invoice = await client.invoices.get(invoice_id, { signal });
      return jsonResult(invoice);
    }),
  );
}
