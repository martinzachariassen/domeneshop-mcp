import { assertDefined } from "../assert.js";
import { type CallOptions, DomeneshopApiError, type HttpTransport } from "../http.js";

export interface Forward {
  host: string;
  frame: boolean;
  url: string;
}

/**
 * The live API answers 404 to GET, PUT and DELETE on `/forwards/{host}` when
 * the host contains a hyphen (e.g. `my-app`), although such forwards can be
 * created and are listed (observed November 2026; hosts without a hyphen and
 * `@` work). Reads fall back to the list; writes cannot, so they explain it.
 */
export class ForwardsResource {
  constructor(private readonly transport: HttpTransport) {}

  async list(domainId: number, call: CallOptions = {}): Promise<Forward[]> {
    const { data } = await this.transport.request<Forward[]>(
      "GET",
      `/domains/${String(domainId)}/forwards/`,
      { signal: call.signal },
    );
    return data ?? [];
  }

  async get(domainId: number, host: string, call: CallOptions = {}): Promise<Forward> {
    try {
      const { data } = await this.transport.request<Forward>("GET", forwardPath(domainId, host), {
        signal: call.signal,
      });
      return assertDefined(data, "domeneshop: empty response for forward");
    } catch (error) {
      const listed = isNotFound(error) ? await this.find(domainId, host, call) : undefined;
      if (listed) {
        return listed;
      }
      throw error;
    }
  }

  /** The API answers 201 with an empty body; the new host is only in the Location header. */
  async create(domainId: number, forward: Forward, call: CallOptions = {}): Promise<Forward> {
    const { headers } = await this.transport.request<undefined>(
      "POST",
      `/domains/${String(domainId)}/forwards/`,
      { body: forward, signal: call.signal },
    );
    const host = hostFromLocation(headers.get("Location"));
    return host !== undefined ? { ...forward, host } : forward;
  }

  /** The spec documents 200 with the forward, but the live API answers 204 with no body. */
  async update(
    domainId: number,
    host: string,
    forward: Forward,
    call: CallOptions = {},
  ): Promise<Forward> {
    try {
      const { data } = await this.transport.request<Forward>("PUT", forwardPath(domainId, host), {
        body: forward,
        signal: call.signal,
      });
      return data ?? forward;
    } catch (error) {
      throw await this.explainNotFound(error, domainId, host, "change", call);
    }
  }

  async delete(domainId: number, host: string, call: CallOptions = {}): Promise<void> {
    try {
      await this.transport.request("DELETE", forwardPath(domainId, host), { signal: call.signal });
    } catch (error) {
      throw await this.explainNotFound(error, domainId, host, "delete", call);
    }
  }

  private async find(
    domainId: number,
    host: string,
    call: CallOptions,
  ): Promise<Forward | undefined> {
    const forwards = await this.list(domainId, call);
    return forwards.find((forward) => forward.host.toLowerCase() === host.toLowerCase());
  }

  private async explainNotFound(
    error: unknown,
    domainId: number,
    host: string,
    action: string,
    call: CallOptions,
  ): Promise<unknown> {
    if (!isNotFound(error) || !(await this.find(domainId, host, call))) {
      return error;
    }
    const reason = host.includes("-")
      ? "the Domeneshop API cannot address forwards whose host contains a hyphen"
      : "the Domeneshop API did not find it by host";
    return new DomeneshopApiError(
      404,
      error.body,
      `The forward for '${host}' exists, but ${reason}. ${capitalize(action)} it in the Domeneshop control panel instead`,
    );
  }
}

function isNotFound(error: unknown): error is DomeneshopApiError {
  return error instanceof DomeneshopApiError && error.statusCode === 404;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
