import { assertDefined } from "../assert.js";
import type { CallOptions, HttpTransport } from "../http.js";

/**
 * The OpenAPI spec omits ANAME, CAA, DS and NS, but the API accepts them;
 * see the record validation in Domeneshop's own client libraries:
 * https://github.com/domeneshop/domeneshop.js (src/lib/interfaces/dnsrecord.ts)
 * and https://github.com/domeneshop/python-domeneshop (domeneshop/client.py).
 */
export const RECORD_TYPES = [
  "A",
  "AAAA",
  "ANAME",
  "CAA",
  "CNAME",
  "DS",
  "MX",
  "NS",
  "SRV",
  "TLSA",
  "TXT",
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

export interface DNSRecord {
  id?: number | undefined;
  host: string;
  ttl?: number | undefined;
  type: string;
  data: string;

  priority?: number | undefined;
  weight?: number | undefined;
  port?: number | undefined;
  usage?: number | undefined;
  selector?: number | undefined;
  dtype?: number | undefined;
  alg?: number | undefined;
  digest?: number | undefined;
  flags?: number | undefined;
  /** Number for DS (key tag), string for CAA (property tag). */
  tag?: number | string | undefined;
}

export class DnsResource {
  constructor(private readonly transport: HttpTransport) {}

  async list(
    domainId: number,
    options: { host?: string | undefined; type?: string | undefined } = {},
    call: CallOptions = {},
  ): Promise<DNSRecord[]> {
    const { data } = await this.transport.request<DNSRecord[]>(
      "GET",
      `/domains/${String(domainId)}/dns`,
      {
        query: { host: options.host, type: options.type },
        signal: call.signal,
      },
    );
    return data ?? [];
  }

  async get(domainId: number, recordId: number, call: CallOptions = {}): Promise<DNSRecord> {
    const { data } = await this.transport.request<DNSRecord>(
      "GET",
      `/domains/${String(domainId)}/dns/${String(recordId)}`,
      { signal: call.signal },
    );
    return assertDefined(data, "domeneshop: empty response for DNS record");
  }

  async create(domainId: number, record: DNSRecord, call: CallOptions = {}): Promise<number> {
    const { data } = await this.transport.request<{ id: number }>(
      "POST",
      `/domains/${String(domainId)}/dns`,
      { body: record, signal: call.signal },
    );
    return assertDefined(data, "domeneshop: empty response for created DNS record").id;
  }

  /** Replaces the whole record: fields left unset are dropped. */
  async update(
    domainId: number,
    recordId: number,
    record: DNSRecord,
    call: CallOptions = {},
  ): Promise<void> {
    await this.transport.request("PUT", `/domains/${String(domainId)}/dns/${String(recordId)}`, {
      body: record,
      signal: call.signal,
    });
  }

  async delete(domainId: number, recordId: number, call: CallOptions = {}): Promise<void> {
    await this.transport.request("DELETE", `/domains/${String(domainId)}/dns/${String(recordId)}`, {
      signal: call.signal,
    });
  }
}
