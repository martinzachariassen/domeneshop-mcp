import { assertDefined } from "../assert.js";
import type { CallOptions, HttpTransport } from "../http.js";

/** "settled" applies only to credit notes. */
export const INVOICE_STATUSES = ["unpaid", "paid", "settled"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface Invoice {
  id: number;
  type?: string | undefined;
  amount?: number | undefined;
  currency?: string | undefined;
  due_date?: string | null | undefined;
  issued_date?: string | undefined;
  paid_date?: string | null | undefined;
  status?: string | undefined;
  url?: string | undefined;
}

export class InvoicesResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Only covers the past three years. `status` is undocumented but supported,
   * see domeneshop.js (src/lib/invoices.ts).
   */
  async list(status?: string, call: CallOptions = {}): Promise<Invoice[]> {
    const { data } = await this.transport.request<Invoice[]>("GET", "/invoices", {
      query: { status },
      signal: call.signal,
    });
    return data ?? [];
  }

  async get(invoiceId: number, call: CallOptions = {}): Promise<Invoice> {
    const { data } = await this.transport.request<Invoice>(
      "GET",
      `/invoices/${String(invoiceId)}`,
      {
        signal: call.signal,
      },
    );
    return assertDefined(data, "domeneshop: empty response for invoice");
  }
}
