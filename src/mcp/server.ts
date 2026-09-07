import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DomeneshopClient } from "../domeneshop/index.js";
import { VERSION } from "../version.js";
import { registerDNSTools } from "./tools/dns.js";
import { registerDomainTools } from "./tools/domains.js";
import { registerDynDNSTools } from "./tools/dyndns.js";
import { registerForwardTools } from "./tools/forwards.js";
import { registerInvoiceTools } from "./tools/invoices.js";

/** Creates an MCP server with all Domeneshop tools registered. */
export function createServer(client: DomeneshopClient): McpServer {
  const server = new McpServer({ name: "domeneshop-mcp", version: VERSION });

  registerDomainTools(server, client);
  registerDNSTools(server, client);
  registerForwardTools(server, client);
  registerDynDNSTools(server, client);
  registerInvoiceTools(server, client);

  return server;
}
