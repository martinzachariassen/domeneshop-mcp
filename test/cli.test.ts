import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import { type CliIO, formatRequest, run, USAGE } from "../src/cli.js";
import { VERSION } from "../src/version.js";

const CREDENTIALS = { DOMENESHOP_API_TOKEN: "token", DOMENESHOP_API_SECRET: "secret" };

function fakeIO(overrides: Partial<CliIO> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const signals = new Map<string, (signal: NodeJS.Signals) => void>();
  const servers: McpServer[] = [];
  const io: CliIO = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    connect: async (server) => {
      servers.push(server);
    },
    onSignal: (signal, handler) => signals.set(signal, handler),
    exit: vi.fn(),
    ...overrides,
  };
  return { io, stdout, stderr, signals, servers };
}

describe("run", () => {
  it.each(["--help", "-h"])("prints usage for %s", async (flag) => {
    const { io, stdout } = fakeIO();
    await expect(run([flag], {}, io)).resolves.toBe(0);
    expect(stdout).toEqual([USAGE]);
  });

  it("documents every environment variable the config reads in the usage text", () => {
    const config = readFileSync(new URL("../src/config.ts", import.meta.url), "utf8");
    const read = [...config.matchAll(/"(DOMENESHOP_[A-Z_]+)"/g)].map((m) => m[1] ?? "");
    expect(read.length).toBeGreaterThan(5);
    for (const name of new Set(read)) {
      expect(USAGE).toContain(name);
    }
  });

  it.each(["--version", "-v", "-version"])("prints the version for %s", async (flag) => {
    const { io, stdout } = fakeIO();
    await expect(run([flag], {}, io)).resolves.toBe(0);
    expect(stdout).toEqual([`domeneshop-mcp ${VERSION}`]);
  });

  it("rejects an unknown argument with exit code 2", async () => {
    const { io, stderr } = fakeIO();
    await expect(run(["--nope"], {}, io)).resolves.toBe(2);
    expect(stderr.join("\n")).toContain('unknown argument "--nope"');
  });

  it("exits 1 with the message on invalid configuration", async () => {
    const { io, stderr, servers } = fakeIO();
    await expect(run([], {}, io)).resolves.toBe(1);
    expect(stderr.join("\n")).toContain("DOMENESHOP_API_TOKEN and DOMENESHOP_API_SECRET");
    expect(servers).toHaveLength(0);
  });

  it("exits 1 when a tool filter names an unknown tool", async () => {
    const { io, stderr } = fakeIO();
    await expect(run([], { ...CREDENTIALS, DOMENESHOP_TOOLS: "nope" }, io)).resolves.toBe(1);
    expect(stderr.join("\n")).toContain("DOMENESHOP_TOOLS names unknown tool(s): nope");
    expect(stderr.join("\n")).not.toContain("    at ");
  });

  it("never prints a stack for a configuration error, even in debug mode", async () => {
    const { io, stderr } = fakeIO();
    await expect(run([], { DOMENESHOP_DEBUG: "1" }, io)).resolves.toBe(1);
    expect(stderr).toHaveLength(1);
  });

  it("prints the stack of an unexpected error in debug mode", async () => {
    const { io, stderr } = fakeIO({
      connect: () => Promise.reject(new Error("transport broke")),
    });
    await expect(run([], { ...CREDENTIALS, DOMENESHOP_DEBUG: "1" }, io)).resolves.toBe(1);
    expect(stderr.join("\n")).toContain("domeneshop-mcp: transport broke");
    expect(stderr.join("\n")).toContain("    at ");
  });

  it("reports a non-Error failure as text", async () => {
    const { io, stderr } = fakeIO({ connect: () => Promise.reject("plain string") });
    await expect(run([], CREDENTIALS, io)).resolves.toBe(1);
    expect(stderr).toEqual(["domeneshop-mcp: plain string"]);
  });

  it("connects quietly when debug is off", async () => {
    const { io, stderr, servers } = fakeIO();
    await expect(run([], CREDENTIALS, io)).resolves.toBeUndefined();
    expect(servers).toHaveLength(1);
    expect(stderr).toEqual([]);
  });

  it("logs warnings from the tool filters", async () => {
    const { io, stderr } = fakeIO();
    await run(
      [],
      { ...CREDENTIALS, DOMENESHOP_READ_ONLY: "1", DOMENESHOP_TOOLS: "delete_forward" },
      io,
    );
    expect(stderr.join("\n")).toContain("warning: delete_forward is listed in DOMENESHOP_TOOLS");
  });

  it("serves only read-only tools in read-only mode", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const { io, stderr } = fakeIO({ connect: (server) => server.connect(serverTransport) });
    const client = new Client({ name: "cli-test", version: "1.0.0" });
    try {
      const env = {
        ...CREDENTIALS,
        DOMENESHOP_READ_ONLY: "true",
        DOMENESHOP_DEBUG: "true",
        DOMENESHOP_TIMEOUT_MS: "5000",
      };
      await expect(run([], env, io)).resolves.toBeUndefined();
      await client.connect(clientTransport);

      const { tools } = await client.listTools();
      expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
      expect(stderr.join("\n")).toContain("connected over stdio (read-only)");
    } finally {
      await client.close();
    }
  });

  it("shuts down once on SIGINT or SIGTERM, logging in debug mode", async () => {
    const { io, stderr, signals } = fakeIO();
    await run([], { ...CREDENTIALS, DOMENESHOP_DEBUG: "1" }, io);
    expect([...signals.keys()].sort()).toEqual(["SIGINT", "SIGTERM"]);

    signals.get("SIGTERM")?.("SIGTERM");
    signals.get("SIGINT")?.("SIGINT");
    await vi.waitFor(() => expect(io.exit).toHaveBeenCalledWith(0));
    expect(io.exit).toHaveBeenCalledTimes(1);
    expect(stderr.join("\n")).toContain("received SIGTERM, shutting down");
    expect(stderr.join("\n")).not.toContain("received SIGINT");
  });

  it("shuts down without logging when debug is off", async () => {
    const { io, stderr, signals } = fakeIO();
    await run([], CREDENTIALS, io);
    signals.get("SIGINT")?.("SIGINT");
    await vi.waitFor(() => expect(io.exit).toHaveBeenCalledWith(0));
    expect(stderr).toEqual([]);
  });

  it("exits 1 when closing the server fails", async () => {
    const { io, signals, servers } = fakeIO();
    await run([], CREDENTIALS, io);
    vi.spyOn(servers[0] as McpServer, "close").mockRejectedValue(new Error("close failed"));
    signals.get("SIGTERM")?.("SIGTERM");
    await vi.waitFor(() => expect(io.exit).toHaveBeenCalledWith(1));
  });
});

describe("formatRequest", () => {
  it.each([
    [{ status: 200, attempt: 1 }, "GET /domains -> 200 in 12 ms"],
    [{ status: undefined, attempt: 1 }, "GET /domains -> no response in 12 ms"],
    [{ status: 503, attempt: 3 }, "GET /domains -> 503 in 12 ms attempt 3"],
  ])("formats %j", (event, expected) => {
    expect(formatRequest({ method: "GET", path: "/domains", durationMs: 12, ...event })).toBe(
      expected,
    );
  });
});
