import { VERSION } from "../version.js";

const DEFAULT_BASE_URL = "https://api.domeneshop.no/v0";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_USER_AGENT = `domeneshop-mcp/${VERSION} (+https://github.com/martinzachariassen/domeneshop-mcp)`;
const MAX_ERROR_DETAIL_LENGTH = 500;
/** Upper bound on any single wait, so a hostile Retry-After cannot stall a tool call. */
const MAX_RETRY_DELAY_MS = 30_000;

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
/** Excludes POST: retrying a create that reached the server could duplicate it. */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE"]);

const STATUS_HINTS: Record<number, string> = {
  400: "The API rejected the request; check the fields against the tool description.",
  401: "Authentication failed; check DOMENESHOP_API_TOKEN and DOMENESHOP_API_SECRET.",
  403: "Access denied; the API credentials lack permission for this resource.",
  404: "Not found; check the ID or host (use the list_* tools to look it up).",
  409: "Conflict; the resource already exists or is in a conflicting state.",
  412: "Precondition failed; a forward's host cannot be changed, so delete the forward and create it again for the new host.",
  429: "Rate limited by the Domeneshop API; wait a moment and try again.",
};
const SERVER_ERROR_HINT = "The Domeneshop API had an internal error; try again later.";

export class DomeneshopApiError extends Error {
  readonly statusCode: number;
  readonly body: string;
  readonly hint: string | undefined;

  /** `hint` replaces the generic advice for the status when the caller knows better. */
  constructor(statusCode: number, body: string, hint?: string) {
    const detail = errorDetail(body);
    hint ??= STATUS_HINTS[statusCode] ?? (statusCode >= 500 ? SERVER_ERROR_HINT : undefined);
    const parts = [`domeneshop: API returned status ${String(statusCode)}`];
    if (detail) {
      parts[0] += `: ${detail}`;
    }
    if (hint) {
      parts.push(hint);
    }
    super(parts.join(". "));
    this.name = "DomeneshopApiError";
    this.statusCode = statusCode;
    this.body = body;
    this.hint = hint;
  }
}

/** The request never produced an HTTP response: timeout, DNS failure, refused connection… */
export class DomeneshopNetworkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DomeneshopNetworkError";
  }
}

export interface HttpTransportOptions {
  baseUrl?: string | undefined;
  /** Per-attempt timeout. Defaults to 30 seconds. */
  timeoutMs?: number | undefined;
  /**
   * Retries for 429 on any method, and for 502/503/504 and network errors on
   * idempotent ones. Defaults to 2.
   */
  maxRetries?: number | undefined;
  userAgent?: string | undefined;
  retryBaseDelayMs?: number | undefined;
  /** Called after every attempt, e.g. for debug logging. Never receives credentials. */
  onResponse?: ((event: RequestEvent) => void) | undefined;
}

export interface RequestEvent {
  method: string;
  path: string;
  /** Undefined when the attempt failed without a response. */
  status: number | undefined;
  durationMs: number;
  attempt: number;
}

export interface RequestOptions {
  query?: Record<string, string | undefined>;
  body?: unknown;
  /** Set false for endpoints with a non-JSON body, e.g. the dynamic DNS update protocol. */
  decodeJson?: boolean;
  /** Also aborts a pending retry wait. */
  signal?: AbortSignal | undefined;
}

export interface CallOptions {
  signal?: AbortSignal | undefined;
}

export interface ApiResponse<T> {
  data: T | undefined;
  /** Some endpoints report their result here rather than in the body — see ForwardsResource.create. */
  headers: Headers;
}

export class HttpTransport {
  private readonly baseUrl: string;
  private readonly authorization: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;
  private readonly retryBaseDelayMs: number;
  private readonly onResponse: ((event: RequestEvent) => void) | undefined;

  constructor(token: string, secret: string, opts: HttpTransportOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.authorization = `Basic ${Buffer.from(`${token}:${secret}`).toString("base64")}`;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
    this.retryBaseDelayMs = opts.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.onResponse = opts.onResponse;
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
      "User-Agent": this.userAgent,
    });
    let body: string | undefined;
    if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers.set("Content-Type", "application/json");
    }

    const upperMethod = method.toUpperCase();
    const idempotent = IDEMPOTENT_METHODS.has(upperMethod);
    let earlierAttemptLost = false;
    for (let attempt = 1; ; attempt++) {
      const retriesLeft = attempt <= this.maxRetries;
      const started = performance.now();
      let response: Response;
      let text: string;
      try {
        const signal = this.attemptSignal(options.signal);
        const init: RequestInit = { method, headers, signal };
        if (body !== undefined) {
          init.body = body;
        }
        response = await fetch(url, init);
        text = await response.text();
      } catch (error) {
        this.emit(method, path, undefined, started, attempt);
        if (options.signal?.aborted) {
          throw options.signal.reason;
        }
        const networkError = toNetworkError(error, method, path, this.timeoutMs, idempotent);
        if (!idempotent || !retriesLeft) {
          throw networkError;
        }
        earlierAttemptLost = true;
        await sleep(this.backoffDelay(attempt, null), options.signal);
        continue;
      }
      this.emit(method, path, response.status, started, attempt);

      if (!response.ok) {
        const deleteAlreadyApplied =
          upperMethod === "DELETE" && earlierAttemptLost && response.status === 404;
        if (deleteAlreadyApplied) {
          return { data: undefined, headers: response.headers };
        }
        if (retriesLeft && isRetryable(response.status, idempotent)) {
          await sleep(
            this.backoffDelay(attempt, response.headers.get("Retry-After")),
            options.signal,
          );
          continue;
        }
        throw new DomeneshopApiError(response.status, text);
      }

      const decodeJson = options.decodeJson ?? true;
      if (!decodeJson || text.length === 0) {
        return { data: undefined, headers: response.headers };
      }
      try {
        return { data: JSON.parse(text) as T, headers: response.headers };
      } catch (error) {
        throw new Error(
          `domeneshop: ${method} ${path} returned status ${String(response.status)} with a body that is not valid JSON: ${truncate(text)}`,
          { cause: error },
        );
      }
    }
  }

  private attemptSignal(caller: AbortSignal | undefined): AbortSignal {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    return caller ? AbortSignal.any([timeout, caller]) : timeout;
  }

  private backoffDelay(attempt: number, retryAfter: string | null): number {
    const fromHeader = parseRetryAfter(retryAfter);
    if (fromHeader !== undefined) {
      return Math.min(fromHeader, MAX_RETRY_DELAY_MS);
    }
    const exponential = this.retryBaseDelayMs * 2 ** (attempt - 1);
    const jitter = Math.random() * this.retryBaseDelayMs;
    return Math.min(exponential + jitter, MAX_RETRY_DELAY_MS);
  }

  private emit(
    method: string,
    path: string,
    status: number | undefined,
    started: number,
    attempt: number,
  ): void {
    this.onResponse?.({
      method,
      path,
      status,
      durationMs: Math.round(performance.now() - started),
      attempt,
    });
  }
}

/** Accepts both delta-seconds and an HTTP date, per RFC 9110. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** 429 means the request was not processed, so even a POST can safely be sent again. */
function isRetryable(status: number, idempotent: boolean): boolean {
  return status === 429 || (idempotent && RETRYABLE_STATUSES.has(status));
}

/**
 * A request without a response may still have been applied, so for a
 * non-idempotent one the message warns against blindly repeating it.
 */
function toNetworkError(
  error: unknown,
  method: string,
  path: string,
  timeoutMs: number,
  idempotent: boolean,
): DomeneshopNetworkError {
  const suffix = idempotent
    ? ""
    : ". The request may still have been applied; check with the matching list tool before retrying";
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new DomeneshopNetworkError(
      `domeneshop: ${method} ${path} timed out after ${String(timeoutMs)} ms${suffix}`,
      { cause: error },
    );
  }
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  const reason = cause instanceof Error ? cause.message : String(cause);
  return new DomeneshopNetworkError(
    `domeneshop: ${method} ${path} failed before a response was received: ${reason}${suffix}`,
    { cause: error },
  );
}

/** Proxies in front of the API can answer with HTML, which is stripped to its text. */
function errorDetail(body: string): string {
  const trimmed = body.trim();
  if (trimmed === "") {
    return "";
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === "object") {
      const fields = parsed as Record<string, unknown>;
      const message = [fields["code"], fields["message"], fields["error"], fields["help"]]
        .filter((value): value is string => typeof value === "string" && value !== "")
        .join(" — ");
      if (message) {
        return truncate(message);
      }
    }
  } catch {}
  if (/^<(!doctype|html)/i.test(trimmed)) {
    return truncate(
      trimmed
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return truncate(trimmed);
}

function truncate(text: string): string {
  return text.length > MAX_ERROR_DETAIL_LENGTH
    ? `${text.slice(0, MAX_ERROR_DETAIL_LENGTH)}…`
    : text;
}
