import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DomeneshopClient } from "../domeneshop/index.js";
import { VERSION } from "../version.js";
import { assertKnownTools, filteredRegistrar, type ToolFilter } from "./registry.js";
import { registerDNSTools } from "./tools/dns.js";
import { registerDomainTools } from "./tools/domains.js";
import { registerDynDNSTools } from "./tools/dyndns.js";
import { registerForwardTools } from "./tools/forwards.js";
import { registerInvoiceTools } from "./tools/invoices.js";

/** Sent to the client on initialize; most hosts add it to the model's system prompt. */
export const INSTRUCTIONS = [
  "Tools for a Domeneshop (domeneshop.no) account: domains, DNS records, HTTP forwards, dynamic DNS and invoices.",
  "Domain-scoped tools take a numeric domain_id: look it up with list_domains first, and DNS record IDs with list_dns_records.",
  "To change part of a DNS record use patch_dns_record; update_dns_record replaces the whole record and drops omitted fields.",
  "upsert_dns_record sets the single record for a host and type, creating it if needed.",
  "TTL values are in seconds (60-604800, a multiple of 60). Use '@' as host for the domain root.",
  "Write tools change live DNS; confirm the intended change with the user before deleting or overwriting records.",
].join("\n");

export type CreateServerOptions = ToolFilter;

/** Throws if the filter names a tool that does not exist. */
export function createServer(
  client: DomeneshopClient,
  options: CreateServerOptions = {},
): McpServer {
  const server = new McpServer(
    {
      name: "domeneshop-mcp",
      title: "Domeneshop",
      version: VERSION,
      websiteUrl: "https://github.com/martinzachariassen/domeneshop-mcp",
    },
    {
      instructions: options.readOnly
        ? `${INSTRUCTIONS}\nThis server runs in read-only mode: no tools that change the account are available.`
        : INSTRUCTIONS,
    },
  );

  const { registrar, names } = filteredRegistrar(server, options);
  registerDomainTools(registrar, client);
  registerDNSTools(registrar, client);
  registerForwardTools(registrar, client);
  registerDynDNSTools(registrar, client);
  registerInvoiceTools(registrar, client);
  assertKnownTools(names, options);

  return server;
}
