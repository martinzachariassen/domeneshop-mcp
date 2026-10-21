/** Thrown for invalid configuration; the CLI prints the message and exits with code 1. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface Config {
  token: string;
  secret: string;
  /** Only register tools annotated read-only. */
  readOnly: boolean;
  /** When set, only these tools are registered. */
  tools: ReadonlySet<string> | undefined;
  /** These tools are never registered. */
  disabledTools: ReadonlySet<string>;
  timeoutMs: number | undefined;
  debug: boolean;
}

export const ENV_HELP = `Environment variables:
  DOMENESHOP_API_TOKEN       API token (required), from https://www.domeneshop.no/admin?view=api
  DOMENESHOP_API_SECRET      API secret (required)
  DOMENESHOP_READ_ONLY       "true" or "1" to expose only read-only tools
  DOMENESHOP_TOOLS           comma-separated allowlist of tool names to expose
  DOMENESHOP_DISABLED_TOOLS  comma-separated tool names to hide
  DOMENESHOP_TIMEOUT_MS      per-request timeout in milliseconds (default 30000)
  DOMENESHOP_DEBUG           "true" or "1" to log each API request to stderr`;

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["", "0", "false", "no", "off"]);

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const token = env["DOMENESHOP_API_TOKEN"]?.trim();
  const secret = env["DOMENESHOP_API_SECRET"]?.trim();
  if (!token || !secret) {
    throw new ConfigError(
      "DOMENESHOP_API_TOKEN and DOMENESHOP_API_SECRET must be set " +
        "(create credentials at https://www.domeneshop.no/admin?view=api)",
    );
  }

  return {
    token,
    secret,
    readOnly: parseBoolean(env, "DOMENESHOP_READ_ONLY"),
    tools: env["DOMENESHOP_TOOLS"]?.trim() ? parseList(env["DOMENESHOP_TOOLS"]) : undefined,
    disabledTools: parseList(env["DOMENESHOP_DISABLED_TOOLS"]),
    timeoutMs: parseTimeout(env["DOMENESHOP_TIMEOUT_MS"]),
    debug: parseBoolean(env, "DOMENESHOP_DEBUG"),
  };
}

export function isTruthy(value: string | undefined): boolean {
  return TRUE_VALUES.has((value ?? "").trim().toLowerCase());
}

function parseBoolean(env: NodeJS.ProcessEnv, name: string): boolean {
  const value = (env[name] ?? "").trim().toLowerCase();
  if (TRUE_VALUES.has(value)) {
    return true;
  }
  if (FALSE_VALUES.has(value)) {
    return false;
  }
  throw new ConfigError(`${name} must be true or false, got "${env[name] ?? ""}"`);
}

function parseList(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== ""),
  );
}

function parseTimeout(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const ms = Number(value);
  if (!Number.isInteger(ms) || ms <= 0) {
    throw new ConfigError(
      `DOMENESHOP_TIMEOUT_MS must be a positive whole number of milliseconds, got "${value}"`,
    );
  }
  return ms;
}
