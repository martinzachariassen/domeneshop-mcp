import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DomeneshopClient } from "../domeneshop/index.js";
import { VERSION } from "../version.js";
import { registerDNSTools } from "./tools/dns.js";
import { registerDomainTools } from "./tools/domains.js";
import { registerDynDNSTools } from "./tools/dyndns.js";
import { registerForwardTools } from "./tools/forwards.js";
import { registerInvoiceTools } from "./tools/invoices.js";

/** Sent to the client on initialize; most hosts add it to the model's system prompt. */
export const INSTRUCTIONS = [
  "Tools for a Domeneshop (domeneshop.no) account: domains, DNS records, HTTP forwards, dynamic DNS and invoices.",
  "Domain-scoped tools take a numeric domain_id: look it up with list_domains first, and DNS record IDs with list_dns_records.",
  "update_dns_record replaces the whole record; read it with get_dns_record and send every field you want to keep.",
  "TTL values are in seconds (60-604800, a multiple of 60). Use '@' as host for the domain root.",
  "Write tools change live DNS; confirm the intended change with the user before deleting or overwriting records.",
].join("\n");

export function createServer(client: DomeneshopClient): McpServer {
  const server = new McpServer(
    {
      name: "domeneshop-mcp",
      title: "Domeneshop",
      version: VERSION,
      websiteUrl: "https://github.com/martinzachariassen/domeneshop-mcp",
    },
    { instructions: INSTRUCTIONS },
  );

  registerDomainTools(server, client);
  registerDNSTools(server, client);
  registerForwardTools(server, client);
  registerDynDNSTools(server, client);
  registerInvoiceTools(server, client);

  return server;
}
