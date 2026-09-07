import { assertDefined } from "../assert.js";
import type { HttpTransport } from "../http.js";

/** An HTTP forward for a subdomain. */
export interface Forward {
  host: string;
  frame: boolean;
  url: string;
}

export class ForwardsResource {
  constructor(private readonly transport: HttpTransport) {}

  /** Lists all HTTP forwards for a domain. */
  async list(domainId: number): Promise<Forward[]> {
    const { data } = await this.transport.request<Forward[]>(
      "GET",
      `/domains/${String(domainId)}/forwards/`,
    );
    return data ?? [];
  }

  /** Retrieves the HTTP forward for a specific host. */
  async get(domainId: number, host: string): Promise<Forward> {
    const { data } = await this.transport.request<Forward>("GET", forwardPath(domainId, host));
    return assertDefined(data, "domeneshop: empty response for forward");
  }

  /**
   * Creates a new HTTP forward.
   *
   * The API answers 201 with an empty body, naming the new forward only in
   * the Location header, so the result is the submitted forward with its
   * host taken from that header when present.
   */
  async create(domainId: number, forward: Forward): Promise<Forward> {
    const { headers } = await this.transport.request<undefined>(
      "POST",
      `/domains/${String(domainId)}/forwards/`,
      { body: forward },
    );
    const host = hostFromLocation(headers.get("Location"));
    return host !== undefined ? { ...forward, host } : forward;
  }

  /** Updates an existing HTTP forward. */
  async update(domainId: number, host: string, forward: Forward): Promise<Forward> {
    const { data } = await this.transport.request<Forward>("PUT", forwardPath(domainId, host), {
      body: forward,
    });
    return assertDefined(data, "domeneshop: empty response for updated forward");
  }

  /** Deletes an HTTP forward. */
  async delete(domainId: number, host: string): Promise<void> {
    await this.transport.request("DELETE", forwardPath(domainId, host));
  }
}

/** Builds the path for a single forward. The host is escaped: it reaches the URL as a path segment. */
function forwardPath(domainId: number, host: string): string {
  return `/domains/${String(domainId)}/forwards/${encodeURIComponent(host)}`;
}

/** Extracts the forward host from a Location header, which points at the created forward's own URL. */
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
