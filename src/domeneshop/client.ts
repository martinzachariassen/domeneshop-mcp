import { HttpTransport } from "./http.js";
import { DnsResource } from "./resources/dns.js";
import { DomainsResource } from "./resources/domains.js";
import { DynDnsResource } from "./resources/dyndns.js";
import { ForwardsResource } from "./resources/forwards.js";
import { InvoicesResource } from "./resources/invoices.js";

export interface DomeneshopClientOptions {
  baseUrl?: string;
}

/** Authenticate with a token/secret pair from https://www.domeneshop.no/admin?view=api. */
export class DomeneshopClient {
  readonly domains: DomainsResource;
  readonly dns: DnsResource;
  readonly forwards: ForwardsResource;
  readonly dynDns: DynDnsResource;
  readonly invoices: InvoicesResource;

  constructor(token: string, secret: string, options: DomeneshopClientOptions = {}) {
    const transport = new HttpTransport(token, secret, options.baseUrl);
    this.domains = new DomainsResource(transport);
    this.dns = new DnsResource(transport);
    this.forwards = new ForwardsResource(transport);
    this.dynDns = new DynDnsResource(transport);
    this.invoices = new InvoicesResource(transport);
  }
}
