#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DomeneshopClient } from "./domeneshop/index.js";
import { createServer } from "./mcp/index.js";
import { VERSION } from "./version.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-version")) {
    console.log(`domeneshop-mcp ${VERSION}`);
    return;
  }

  const token = process.env["DOMENESHOP_API_TOKEN"];
  const secret = process.env["DOMENESHOP_API_SECRET"];
  if (!token || !secret) {
    console.error(
      "DOMENESHOP_API_TOKEN and DOMENESHOP_API_SECRET must be set " +
        "(create credentials at https://www.domeneshop.no/admin?view=api)",
    );
    process.exitCode = 1;
    return;
  }

  const client = new DomeneshopClient(token, secret);
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("domeneshop-mcp:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
