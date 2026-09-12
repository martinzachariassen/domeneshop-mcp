import { assertDefined } from "../assert.js";
import type { HttpTransport } from "../http.js";

/** "settled" applies only to credit notes. */
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
   * Only returns invoices from the past three years. The status parameter is
   * undocumented but supported — see domeneshop.js (src/lib/invoices.ts).
   */
  async list(status?: string): Promise<Invoice[]> {
    const { data } = await this.transport.request<Invoice[]>("GET", "/invoices", {
      query: { status },
    });
    return data ?? [];
  }

  async get(invoiceId: number): Promise<Invoice> {
    const { data } = await this.transport.request<Invoice>("GET", `/invoices/${String(invoiceId)}`);
    return assertDefined(data, "domeneshop: empty response for invoice");
  }
}
