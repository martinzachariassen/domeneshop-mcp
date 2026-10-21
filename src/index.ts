#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConfigError, ENV_HELP, isTruthy, loadConfig } from "./config.js";
import { DomeneshopClient, type RequestEvent } from "./domeneshop/index.js";
import { createServer } from "./mcp/index.js";
import { VERSION } from "./version.js";

const USAGE = `domeneshop-mcp ${VERSION}
MCP server for the Domeneshop API, speaking the MCP stdio transport.

Usage: domeneshop-mcp [--help | --version]

Options:
  -h, --help     Show this help and exit
  -v, --version  Print the version and exit

${ENV_HELP}

Docs: https://github.com/martinzachariassen/domeneshop-mcp#readme`;

/** stdout carries the MCP protocol, so every diagnostic goes to stderr. */
function log(message: string): void {
  console.error(`domeneshop-mcp: ${message}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg === "--help" || arg === "-h")) {
    console.log(USAGE);
    return;
  }
  if (args.some((arg) => arg === "--version" || arg === "-version" || arg === "-v")) {
    console.log(`domeneshop-mcp ${VERSION}`);
    return;
  }
  if (args.length > 0) {
    log(`unknown argument "${args[0] ?? ""}". Run with --help for usage.`);
    process.exitCode = 2;
    return;
  }

  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      log(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const client = new DomeneshopClient(config.token, config.secret, {
    timeoutMs: config.timeoutMs,
    onResponse: config.debug ? logRequest : undefined,
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
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await server.connect(new StdioServerTransport());
  if (config.debug) {
    log(`v${VERSION} connected over stdio${config.readOnly ? " (read-only)" : ""}`);
  }
}

function logRequest(event: RequestEvent): void {
  const status = event.status === undefined ? "no response" : String(event.status);
  const attempt = event.attempt > 1 ? ` attempt ${String(event.attempt)}` : "";
  log(`${event.method} ${event.path} -> ${status} in ${String(event.durationMs)} ms${attempt}`);
}

main().catch((error: unknown) => {
  log(error instanceof Error ? error.message : String(error));
  if (isTruthy(process.env["DOMENESHOP_DEBUG"]) && error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
