import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

const credentials = { DOMENESHOP_API_TOKEN: "token", DOMENESHOP_API_SECRET: "secret" };

describe("loadConfig", () => {
  it("uses safe defaults when only credentials are set", () => {
    expect(loadConfig(credentials)).toEqual({
      token: "token",
      secret: "secret",
      readOnly: false,
      tools: undefined,
      disabledTools: new Set(),
      timeoutMs: undefined,
      debug: false,
    });
  });

  it("trims whitespace around credentials, a common copy-paste mistake", () => {
    const config = loadConfig({
      DOMENESHOP_API_TOKEN: " token\n",
      DOMENESHOP_API_SECRET: "\tsecret ",
    });
    expect(config.token).toBe("token");
    expect(config.secret).toBe("secret");
  });

  it.each([
    [{}],
    [{ DOMENESHOP_API_TOKEN: "token" }],
    [{ DOMENESHOP_API_TOKEN: "token", DOMENESHOP_API_SECRET: "   " }],
  ])("rejects missing credentials %#", (env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it.each(["1", "true", "TRUE", "yes", "on"])("treats %s as true", (value) => {
    expect(loadConfig({ ...credentials, DOMENESHOP_READ_ONLY: value }).readOnly).toBe(true);
  });

  it.each(["0", "false", "no", "off", ""])("treats %j as false", (value) => {
    expect(loadConfig({ ...credentials, DOMENESHOP_READ_ONLY: value }).readOnly).toBe(false);
  });

  it("rejects an unrecognised boolean instead of guessing", () => {
    expect(() => loadConfig({ ...credentials, DOMENESHOP_READ_ONLY: "maybe" })).toThrow(
      'DOMENESHOP_READ_ONLY must be true or false, got "maybe"',
    );
  });

  it("parses comma-separated tool lists, ignoring blanks and spaces", () => {
    const config = loadConfig({
      ...credentials,
      DOMENESHOP_TOOLS: " list_domains, get_domain ,,",
      DOMENESHOP_DISABLED_TOOLS: "delete_dns_record",
    });
    expect(config.tools).toEqual(new Set(["list_domains", "get_domain"]));
    expect(config.disabledTools).toEqual(new Set(["delete_dns_record"]));
  });

  it("treats an empty allowlist as unset rather than as 'no tools'", () => {
    expect(loadConfig({ ...credentials, DOMENESHOP_TOOLS: " " }).tools).toBeUndefined();
  });

  it("parses the timeout and rejects nonsense", () => {
    expect(loadConfig({ ...credentials, DOMENESHOP_TIMEOUT_MS: "5000" }).timeoutMs).toBe(5000);
    for (const value of ["0", "-1", "1.5", "soon"]) {
      expect(() => loadConfig({ ...credentials, DOMENESHOP_TIMEOUT_MS: value })).toThrow(
        ConfigError,
      );
    }
  });
});
