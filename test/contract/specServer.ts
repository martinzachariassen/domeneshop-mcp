import type { ServerResponse } from "node:http";
import { startTestServer, type TestServer } from "#testing/testServer.js";
import { matchOperation, validateRequestBody, validateResponse } from "./openapi.js";

const base = { id: 1, host: "www", ttl: 3600 };

/** One record per type, each valid against the spec (or its overlay). */
export const RECORDS = {
  A: { ...base, id: 1, type: "A", data: "192.0.2.1" },
  AAAA: { ...base, id: 2, type: "AAAA", data: "2001:db8::1" },
  CNAME: { ...base, id: 3, type: "CNAME", data: "www.example.com" },
  MX: { ...base, id: 4, host: "@", type: "MX", data: "mx.example.com", priority: 10 },
  SRV: {
    ...base,
    id: 5,
    host: "_sip._tcp",
    type: "SRV",
    data: "sip.example.com",
    priority: 10,
    weight: 100,
    port: 5060,
  },
  TLSA: {
    ...base,
    id: 6,
    host: "_443._tcp",
    type: "TLSA",
    data: "7FF8B87BB269715FEF08A0F4F0033D7A2F3B680470A30E878CEB2D3E244AF3EA",
    usage: 3,
    selector: 1,
    dtype: 1,
  },
  TXT: { ...base, id: 7, host: "@", type: "TXT", data: "v=spf1 include:_spf.domeneshop.no ~all" },
  ANAME: { ...base, id: 8, host: "@", type: "ANAME", data: "lb.example.net" },
  NS: { ...base, id: 9, host: "sub", type: "NS", data: "ns1.hyp.net" },
  CAA: { ...base, id: 10, host: "@", type: "CAA", data: "letsencrypt.org", flags: 0, tag: "issue" },
  DS: { ...base, id: 11, host: "@", type: "DS", data: "AB12", tag: 12345, alg: 13, digest: 2 },
} as const;

export const DOMAIN_FULL = {
  id: 1,
  domain: "example.com",
  expiry_date: "2027-01-01",
  registered_date: "2020-01-01",
  renew: true,
  registrant: "Ola Nordmann",
  status: "active",
  nameservers: ["ns1.hyp.net", "ns2.hyp.net", "ns3.hyp.net"],
  services: { registrar: true, dns: true, email: true, webhotel: "none" },
};
export const DOMAIN_MINIMAL = { id: 2, domain: "example.no" };

export const FORWARD_FULL = { host: "www", frame: false, url: "https://www.example.com" };
export const FORWARD_MINIMAL = { host: "@", url: "ftp://ftp.example.com" };

export const INVOICE_FULL = {
  id: 1,
  type: "invoice",
  amount: 120,
  currency: "NOK",
  due_date: "2026-01-15",
  issued_date: "2026-01-01",
  paid_date: "2026-01-10",
  status: "paid",
  url: "https://www.domeneshop.no/invoice?nr=1&code=",
};
export const INVOICE_MINIMAL = { id: 2 };
export const CREDIT_NOTE = {
  id: 3,
  type: "credit_note",
  amount: -120,
  currency: "NOK",
  issued_date: "2026-02-01",
  status: "settled",
};

export interface Canned {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** The success response the spec documents for each operation, with example bodies. */
export const SUCCESS: Record<string, Canned> = {
  "GET /domains": { status: 200, body: [DOMAIN_FULL, DOMAIN_MINIMAL] },
  "GET /domains/{domainId}": { status: 200, body: DOMAIN_FULL },
  "GET /domains/{domainId}/dns": { status: 200, body: Object.values(RECORDS) },
  "POST /domains/{domainId}/dns": { status: 201, body: { id: 1 } },
  "GET /domains/{domainId}/dns/{recordId}": { status: 200, body: RECORDS.A },
  "PUT /domains/{domainId}/dns/{recordId}": { status: 204 },
  "DELETE /domains/{domainId}/dns/{recordId}": { status: 204 },
  "GET /domains/{domainId}/forwards/": { status: 200, body: [FORWARD_FULL, FORWARD_MINIMAL] },
  "POST /domains/{domainId}/forwards/": {
    status: 201,
    headers: { Location: "/v0/domains/1/forwards/www" },
  },
  "GET /domains/{domainId}/forwards/{host}": { status: 200, body: FORWARD_FULL },
  "PUT /domains/{domainId}/forwards/{host}": { status: 200, body: FORWARD_FULL },
  "DELETE /domains/{domainId}/forwards/{host}": { status: 204 },
  "GET /invoices": { status: 200, body: [INVOICE_FULL, INVOICE_MINIMAL, CREDIT_NOTE] },
  "GET /invoices/{invoiceId}": { status: 200, body: INVOICE_FULL },
  "GET /dyndns/update": { status: 204 },
};

export interface SpecServer extends TestServer {
  /** Every way a request or canned response broke the spec. */
  violations: string[];
  /** Operation keys the server was called with. */
  hits: Set<string>;
}

/**
 * A fake Domeneshop API that checks every request against the spec and
 * answers with the documented success response, or `override` when it
 * returns one for that operation.
 */
export async function startSpecServer(
  override: (key: string) => Canned | undefined = () => undefined,
): Promise<SpecServer> {
  const violations: string[] = [];
  const hits = new Set<string>();

  const server = await startTestServer((req, res, body) => {
    const { match, violations: found } = matchOperation(
      req.method ?? "",
      req.url ?? "",
      req.headers.authorization,
    );
    violations.push(...found);
    if (!match) {
      reply(res, { status: 404 });
      return;
    }
    hits.add(match.key);
    violations.push(...validateRequestBody(match, body));

    const canned = override(match.key) ?? SUCCESS[match.key] ?? { status: 500 };
    violations.push(...validateResponse(match.key, canned.status, canned.body));
    reply(res, canned);
  });

  return { ...server, violations, hits };
}

function reply(res: ServerResponse, canned: Canned): void {
  const headers: Record<string, string> = { ...canned.headers };
  if (canned.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  res.writeHead(canned.status, headers);
  res.end(canned.body === undefined ? undefined : JSON.stringify(canned.body));
}
