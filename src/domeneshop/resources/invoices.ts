import { assertDefined } from "../assert.js";
import type { HttpTransport } from "../http.js";

/** The accepted values for the ListInvoices status filter. "settled" applies only to credit notes. */
export const INVOICE_STATUSES = ["unpaid", "paid", "settled"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface Invoice {
  id: number;
  type: string;
  amount: number;
  currency: string;
  due_date: string;
  issued_date: string;
  paid_date: string;
  status: string;
  url: string;
}

export class InvoicesResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Lists invoices from the past three years, optionally filtered by status.
   *
   * The status query parameter is missing from the published OpenAPI spec
   * but is supported; Domeneshop's own JavaScript client relies on it. See
   * https://github.com/domeneshop/domeneshop.js (src/lib/invoices.ts).
   */
  async list(status?: string): Promise<Invoice[]> {
    const { data } = await this.transport.request<Invoice[]>("GET", "/invoices", {
      query: { status },
    });
    return data ?? [];
  }

  /** Retrieves a single invoice. */
  async get(invoiceId: number): Promise<Invoice> {
    const { data } = await this.transport.request<Invoice>("GET", `/invoices/${String(invoiceId)}`);
    return assertDefined(data, "domeneshop: empty response for invoice");
  }
}
