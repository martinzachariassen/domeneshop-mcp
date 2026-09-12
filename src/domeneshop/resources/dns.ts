import { assertDefined } from "../assert.js";
import type { HttpTransport } from "../http.js";

/**
 * Every DNS record type the Domeneshop API accepts.
 *
 * The published OpenAPI spec only documents A, AAAA, CNAME, MX, SRV, TLSA
 * and TXT, but ANAME, CAA, DS and NS are equally supported — see the record
 * validation in Domeneshop's own client libraries:
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

  /** MX and SRV: preference, lower is tried first. */
  priority?: number | undefined;
  /** SRV only. */
  weight?: number | undefined;
  port?: number | undefined;
  /** TLSA only. */
  usage?: number | undefined;
  selector?: number | undefined;
  dtype?: number | undefined;
  /** DS only: alg is the signing algorithm, digest the digest type. */
  alg?: number | undefined;
  digest?: number | undefined;
  /** CAA only. */
  flags?: number | undefined;
  /**
   * The key tag for DS and the property tag for CAA. Domeneshop documents
   * neither precisely, so this is kept loosely typed rather than forced
   * into one shape.
   */
  tag?: number | string | undefined;
}

export class DnsResource {
  constructor(private readonly transport: HttpTransport) {}

  async list(
    domainId: number,
    options: { host?: string | undefined; type?: string | undefined } = {},
  ): Promise<DNSRecord[]> {
    const { data } = await this.transport.request<DNSRecord[]>(
      "GET",
      `/domains/${String(domainId)}/dns`,
      {
        query: { host: options.host, type: options.type },
      },
    );
    return data ?? [];
  }

  async get(domainId: number, recordId: number): Promise<DNSRecord> {
    const { data } = await this.transport.request<DNSRecord>(
      "GET",
      `/domains/${String(domainId)}/dns/${String(recordId)}`,
    );
    return assertDefined(data, "domeneshop: empty response for DNS record");
  }

  async create(domainId: number, record: DNSRecord): Promise<number> {
    const { data } = await this.transport.request<{ id: number }>(
      "POST",
      `/domains/${String(domainId)}/dns`,
      { body: record },
    );
    return assertDefined(data, "domeneshop: empty response for created DNS record").id;
  }

  /**
   * Replaces an existing DNS record. Fields left unset on `record` are
   * dropped from the stored record, so callers should send it in full.
   */
  async update(domainId: number, recordId: number, record: DNSRecord): Promise<void> {
    await this.transport.request("PUT", `/domains/${String(domainId)}/dns/${String(recordId)}`, {
      body: record,
    });
  }

  async delete(domainId: number, recordId: number): Promise<void> {
    await this.transport.request("DELETE", `/domains/${String(domainId)}/dns/${String(recordId)}`);
  }
}
