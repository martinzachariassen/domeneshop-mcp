import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { readOnly } from "../annotations.js";
import { domainIdField, domainOutput } from "../fields.js";
import { jsonResult, listResult } from "../result.js";
import type { InferShape } from "../schema.js";
import { toolHandler } from "../tool.js";

const listDomainsShape = {
  filter: z
    .string()
    .optional()
    .describe("only return domains whose name contains this text, e.g. '.no'"),
};
type ListDomainsArgs = InferShape<typeof listDomainsShape>;

const getDomainShape = {
  domain_id: domainIdField,
};
type GetDomainArgs = InferShape<typeof getDomainShape>;

export function registerDomainTools(server: McpServer, client: DomeneshopClient): void {
  server.registerTool(
    "list_domains",
    {
      description:
        "List all domains on the Domeneshop account, optionally filtered by domain name. " +
        "Use this first to find the domain_id the other tools need.",
      inputSchema: listDomainsShape,
      outputSchema: { domains: z.array(domainOutput) },
      ...readOnly("List domains"),
    },
    toolHandler<ListDomainsArgs>(async ({ filter }, { signal }) => {
      const domains = await client.domains.list(filter, { signal });
      return listResult("domains", domains);
    }),
  );

  server.registerTool(
    "get_domain",
    {
      description:
        "Get details for a single domain by its Domeneshop domain ID: expiry, renewal, nameservers and active services.",
      inputSchema: getDomainShape,
      outputSchema: domainOutput,
      ...readOnly("Get domain"),
    },
    toolHandler<GetDomainArgs>(async ({ domain_id }, { signal }) => {
      const domain = await client.domains.get(domain_id, { signal });
      return jsonResult(domain);
    }),
  );
}
