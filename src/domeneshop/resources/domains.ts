import { assertDefined } from "../assert.js";
import type { CallOptions, HttpTransport } from "../http.js";

export interface DomainServices {
  dns?: boolean | undefined;
  email?: boolean | undefined;
  registrar?: boolean | undefined;
  webhotel?: string | undefined;
}

/** The spec marks no field as required; `id` and `domain` are always present in practice. */
export interface Domain {
  id: number;
  domain: string;
  expiry_date?: string | undefined;
  nameservers?: string[] | undefined;
  registrant?: string | undefined;
  registered_date?: string | undefined;
  renew?: boolean | undefined;
  services?: DomainServices | undefined;
  status?: string | undefined;
}

export class DomainsResource {
  constructor(private readonly transport: HttpTransport) {}

  async list(filter?: string, call: CallOptions = {}): Promise<Domain[]> {
    const { data } = await this.transport.request<Domain[]>("GET", "/domains", {
      query: { domain: filter },
      signal: call.signal,
    });
    return data ?? [];
  }

  async get(domainId: number, call: CallOptions = {}): Promise<Domain> {
    const { data } = await this.transport.request<Domain>("GET", `/domains/${String(domainId)}`, {
      signal: call.signal,
    });
    return assertDefined(data, "domeneshop: empty response for domain");
  }
}
