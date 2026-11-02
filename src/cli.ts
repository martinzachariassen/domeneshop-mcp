import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConfigError, ENV_HELP, isTruthy, loadConfig } from "./config.js";
import { DomeneshopClient, type RequestEvent } from "./domeneshop/index.js";
import { createServer } from "./mcp/index.js";
import { VERSION } from "./version.js";

export const USAGE = `domeneshop-mcp ${VERSION}
MCP server for the Domeneshop API, speaking the MCP stdio transport.

Usage: domeneshop-mcp [--help | --version]

Options:
  -h, --help     Show this help and exit
  -v, --version  Print the version and exit

${ENV_HELP}

Docs: https://github.com/martinzachariassen/domeneshop-mcp#readme`;

/** The process boundary, injected so the CLI can run in-process under test. */
export interface CliIO {
  /** stdout carries the MCP protocol, so only --help and --version write here. */
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  connect: (server: McpServer) => Promise<void>;
  onSignal: (signal: NodeJS.Signals, handler: (signal: NodeJS.Signals) => void) => void;
  exit: (code: number) => void;
}

/**
 * Runs the CLI. Resolves with an exit code when it is done, or with
 * `undefined` once the server is connected and should keep running.
 */
export async function run(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  io: CliIO,
): Promise<number | undefined> {
  const log = (message: string): void => io.stderr(`domeneshop-mcp: ${message}`);
  try {
    return await start(argv, env, io, log);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    const expected = error instanceof ConfigError;
    if (!expected && isTruthy(env["DOMENESHOP_DEBUG"]) && error instanceof Error && error.stack) {
      io.stderr(error.stack);
    }
    return 1;
  }
}

async function start(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  io: CliIO,
  log: (message: string) => void,
): Promise<number | undefined> {
  if (argv.some((arg) => arg === "--help" || arg === "-h")) {
    io.stdout(USAGE);
    return 0;
  }
  if (argv.some((arg) => arg === "--version" || arg === "-version" || arg === "-v")) {
    io.stdout(`domeneshop-mcp ${VERSION}`);
    return 0;
  }
  if (argv.length > 0) {
    log(`unknown argument "${argv[0] ?? ""}". Run with --help for usage.`);
    return 2;
  }

  const config = loadConfig(env);

  const client = new DomeneshopClient(config.token, config.secret, {
    timeoutMs: config.timeoutMs,
    onResponse: config.debug ? (event) => log(formatRequest(event)) : undefined,
  });
  const server = createServer(client, {
    readOnly: config.readOnly,
    tools: config.tools,
    disabledTools: config.disabledTools,
    onWarning: (message) => log(`warning: ${message}`),
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    if (config.debug) {
      log(`received ${signal}, shutting down`);
    }
    server.close().then(
      () => io.exit(0),
      () => io.exit(1),
    );
  };
  io.onSignal("SIGINT", shutdown);
  io.onSignal("SIGTERM", shutdown);

  await io.connect(server);
  if (config.debug) {
    log(`v${VERSION} connected over stdio${config.readOnly ? " (read-only)" : ""}`);
  }
  return undefined;
}

export function formatRequest(event: RequestEvent): string {
  const status = event.status === undefined ? "no response" : String(event.status);
  const attempt = event.attempt > 1 ? ` attempt ${String(event.attempt)}` : "";
  return `${event.method} ${event.path} -> ${status} in ${String(event.durationMs)} ms${attempt}`;
}
