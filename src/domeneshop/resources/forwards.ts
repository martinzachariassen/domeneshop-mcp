import { assertDefined } from "../assert.js";
import type { HttpTransport } from "../http.js";

export interface Forward {
  host: string;
  frame: boolean;
  url: string;
}

export class ForwardsResource {
  constructor(private readonly transport: HttpTransport) {}

  async list(domainId: number): Promise<Forward[]> {
    const { data } = await this.transport.request<Forward[]>(
      "GET",
      `/domains/${String(domainId)}/forwards/`,
    );
    return data ?? [];
  }

  async get(domainId: number, host: string): Promise<Forward> {
    const { data } = await this.transport.request<Forward>("GET", forwardPath(domainId, host));
    return assertDefined(data, "domeneshop: empty response for forward");
  }

  /** The API answers 201 with an empty body; the new host is only in the Location header. */
  async create(domainId: number, forward: Forward): Promise<Forward> {
    const { headers } = await this.transport.request<undefined>(
      "POST",
      `/domains/${String(domainId)}/forwards/`,
      { body: forward },
    );
    const host = hostFromLocation(headers.get("Location"));
    return host !== undefined ? { ...forward, host } : forward;
  }

  async update(domainId: number, host: string, forward: Forward): Promise<Forward> {
    const { data } = await this.transport.request<Forward>("PUT", forwardPath(domainId, host), {
      body: forward,
    });
    return assertDefined(data, "domeneshop: empty response for updated forward");
  }

  async delete(domainId: number, host: string): Promise<void> {
    await this.transport.request("DELETE", forwardPath(domainId, host));
  }
}

function forwardPath(domainId: number, host: string): string {
  return `/domains/${String(domainId)}/forwards/${encodeURIComponent(host)}`;
}

function hostFromLocation(location: string | null): string | undefined {
  if (!location) {
    return undefined;
  }
  const segment = location.slice(location.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(segment) || undefined;
  } catch {
    return segment || undefined;
  }
}
