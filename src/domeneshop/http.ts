/**
 * Minimal HTTP transport for the Domeneshop API
 * (https://api.domeneshop.no/docs/), authenticated via HTTP Basic Auth using
 * an API token and secret from https://www.domeneshop.no/admin?view=api.
 */

const DEFAULT_BASE_URL = "https://api.domeneshop.no/v0";

/** Thrown for non-2xx responses from the Domeneshop API. */
export class DomeneshopApiError extends Error {
  readonly statusCode: number;
  readonly body: string;

  constructor(statusCode: number, body: string) {
    super(
      body
        ? `domeneshop: unexpected status ${String(statusCode)}: ${body}`
        : `domeneshop: unexpected status ${String(statusCode)}`,
    );
    this.name = "DomeneshopApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

export interface RequestOptions {
  /** Query parameters. Undefined and empty-string values are omitted. */
  query?: Record<string, string | undefined>;
  /** Request body, marshalled as JSON. */
  body?: unknown;
  /**
   * Whether to parse the response body as JSON. Defaults to true; set to
   * false for endpoints that return a non-JSON (or irrelevant) body, such
   * as the dynamic DNS update protocol's plain-text response.
   */
  decodeJson?: boolean;
}

export interface ApiResponse<T> {
  /** The parsed JSON response body, or undefined if the response was empty. */
  data: T | undefined;
  /**
   * The raw response headers. Some endpoints report their result there
   * rather than in the body — see ForwardsResource.create.
   */
  headers: Headers;
}

/**
 * HttpTransport performs authenticated HTTP requests against the Domeneshop
 * API and decodes JSON responses. It has no knowledge of individual
 * endpoints; that lives in the resource classes built on top of it.
 */
export class HttpTransport {
  private readonly baseUrl: string;
  private readonly authorization: string;

  constructor(token: string, secret: string, baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.authorization = `Basic ${Buffer.from(`${token}:${secret}`).toString("base64")}`;
  }

  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }

    const headers = new Headers({
      Accept: "application/json",
      Authorization: this.authorization,
    });

    const init: RequestInit = { method, headers };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, init);
    const text = await response.text();

    if (!response.ok) {
      throw new DomeneshopApiError(response.status, text);
    }

    const decodeJson = options.decodeJson ?? true;
    const data = decodeJson && text.length > 0 ? (JSON.parse(text) as T) : undefined;
    return { data, headers: response.headers };
  }
}
