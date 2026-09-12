import { assertDefined } from "../assert.js";
import type { HttpTransport } from "../http.js";

export interface DomainServices {
  dns: boolean;
  email: boolean;
  registrar: boolean;
  webhotel: string;
}

export interface Domain {
  id: number;
  domain: string;
  expiry_date: string;
  nameservers: string[];
  registrant: string;
  registered_date: string;
  renew: boolean;
  services: DomainServices;
  status: string;
}

export class DomainsResource {
  constructor(private readonly transport: HttpTransport) {}

  async list(filter?: string): Promise<Domain[]> {
    const { data } = await this.transport.request<Domain[]>("GET", "/domains", {
      query: { domain: filter },
    });
    return data ?? [];
  }

  async get(domainId: number): Promise<Domain> {
    const { data } = await this.transport.request<Domain>("GET", `/domains/${String(domainId)}`);
    return assertDefined(data, "domeneshop: empty response for domain");
  }
}
