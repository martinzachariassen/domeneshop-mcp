import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { readOnly } from "../annotations.js";
import { jsonResult } from "../result.js";
import type { InferShape } from "../schema.js";
import { toolHandler } from "../tool.js";

const listDomainsShape = {
  filter: z.string().optional().describe("only return domains matching this name"),
};
type ListDomainsArgs = InferShape<typeof listDomainsShape>;

const getDomainShape = {
  domain_id: z.number().int().describe("the Domeneshop domain ID, from list_domains"),
};
type GetDomainArgs = InferShape<typeof getDomainShape>;

export function registerDomainTools(server: McpServer, client: DomeneshopClient): void {
  server.registerTool(
    "list_domains",
    {
      description:
        "List all domains on the Domeneshop account, optionally filtered by domain name.",
      inputSchema: listDomainsShape,
      annotations: readOnly(),
    },
    toolHandler<ListDomainsArgs>(async ({ filter }) => {
      const domains = await client.domains.list(filter);
      return jsonResult(domains);
    }),
  );

  server.registerTool(
    "get_domain",
    {
      description: "Get details for a single domain by its Domeneshop domain ID.",
      inputSchema: getDomainShape,
      annotations: readOnly(),
    },
    toolHandler<GetDomainArgs>(async ({ domain_id }) => {
      const domain = await client.domains.get(domain_id);
      return jsonResult(domain);
    }),
  );
}
