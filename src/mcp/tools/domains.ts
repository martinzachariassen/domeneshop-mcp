import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { readOnly } from "../annotations.js";
import { domainIdField } from "../fields.js";
import { domainOutput } from "../outputs.js";
import type { ToolRegistrar } from "../registry.js";
import { jsonResult, listResult } from "../result.js";
import { toolHandler } from "../tool.js";

export function registerDomainTools(server: ToolRegistrar, client: DomeneshopClient): void {
  server.registerTool(
    "list_domains",
    {
      description:
        "List all domains on the Domeneshop account, optionally filtered by domain name. " +
        "Use this first to find the domain_id the other tools need.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("only return domains whose name contains this text, e.g. '.no'"),
      }),
      outputSchema: z.object({ domains: z.array(domainOutput) }),
      ...readOnly("List domains"),
    },
    toolHandler(async ({ filter }, { signal }) => {
      const domains = await client.domains.list(filter, { signal });
      return listResult("domains", domains);
    }),
  );

  server.registerTool(
    "get_domain",
    {
      description:
        "Get details for a single domain by its Domeneshop domain ID: expiry, renewal, nameservers and active services.",
      inputSchema: z.object({ domain_id: domainIdField }),
      outputSchema: domainOutput,
      ...readOnly("Get domain"),
    },
    toolHandler(async ({ domain_id }, { signal }) => {
      const domain = await client.domains.get(domain_id, { signal });
      return jsonResult(domain);
    }),
  );
}
