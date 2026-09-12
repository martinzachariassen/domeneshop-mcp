const DEFAULT_BASE_URL = "https://api.domeneshop.no/v0";

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
  query?: Record<string, string | undefined>;
  body?: unknown;
  /** Set false for endpoints with a non-JSON body, e.g. the dynamic DNS update protocol. */
  decodeJson?: boolean;
}

export interface ApiResponse<T> {
  data: T | undefined;
  /** Some endpoints report their result here rather than in the body — see ForwardsResource.create. */
  headers: Headers;
}

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
