import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { additive, destructive, readOnly } from "../annotations.js";
import { jsonResult, textResult } from "../result.js";
import type { InferShape } from "../schema.js";
import { toolHandler } from "../tool.js";

const listForwardsShape = {
  domain_id: z.number().int().describe("the Domeneshop domain ID, from list_domains"),
};
type ListForwardsArgs = InferShape<typeof listForwardsShape>;

const getForwardShape = {
  domain_id: z.number().int().describe("the Domeneshop domain ID, from list_domains"),
  host: z
    .string()
    .describe("the host/subdomain the forward applies to, e.g. 'www' or '@' for the root"),
};
type GetForwardArgs = InferShape<typeof getForwardShape>;

const forwardShape = {
  domain_id: z.number().int().describe("the Domeneshop domain ID, from list_domains"),
  host: z.string().describe("the host/subdomain to forward, e.g. 'www' or '@' for the root"),
  url: z.string().describe("the destination URL to forward requests to"),
  frame: z
    .boolean()
    .optional()
    .describe("if true, show the destination in a frame instead of redirecting"),
};
type ForwardArgs = InferShape<typeof forwardShape>;

const deleteForwardShape = {
  domain_id: z.number().int().describe("the Domeneshop domain ID, from list_domains"),
  host: z.string().describe("the host/subdomain whose forward should be deleted"),
};
type DeleteForwardArgs = InferShape<typeof deleteForwardShape>;

export function registerForwardTools(server: McpServer, client: DomeneshopClient): void {
  server.registerTool(
    "list_forwards",
    {
      description: "List all HTTP forwards configured for a domain.",
      inputSchema: listForwardsShape,
      annotations: readOnly(),
    },
    toolHandler<ListForwardsArgs>(async ({ domain_id }) => {
      const forwards = await client.forwards.list(domain_id);
      return jsonResult(forwards);
    }),
  );

  server.registerTool(
    "get_forward",
    {
      description: "Get the HTTP forward configured for a specific host.",
      inputSchema: getForwardShape,
      annotations: readOnly(),
    },
    toolHandler<GetForwardArgs>(async ({ domain_id, host }) => {
      const forward = await client.forwards.get(domain_id, host);
      return jsonResult(forward);
    }),
  );

  server.registerTool(
    "create_forward",
    {
      description:
        "Create a new HTTP forward for a domain. Fails if the host already has a forward or a conflicting A, AAAA, ANAME or CNAME record.",
      inputSchema: forwardShape,
      annotations: additive(),
    },
    toolHandler<ForwardArgs>(async ({ domain_id, host, url, frame }) => {
      const created = await client.forwards.create(domain_id, { host, url, frame: frame ?? false });
      return jsonResult(created);
    }),
  );

  server.registerTool(
    "update_forward",
    {
      description: "Update an existing HTTP forward for a domain.",
      inputSchema: forwardShape,
      annotations: destructive(),
    },
    toolHandler<ForwardArgs>(async ({ domain_id, host, url, frame }) => {
      const updated = await client.forwards.update(domain_id, host, {
        host,
        url,
        frame: frame ?? false,
      });
      return jsonResult(updated);
    }),
  );

  server.registerTool(
    "delete_forward",
    {
      description: "Delete an HTTP forward.",
      inputSchema: deleteForwardShape,
      annotations: destructive(),
    },
    toolHandler<DeleteForwardArgs>(async ({ domain_id, host }) => {
      await client.forwards.delete(domain_id, host);
      return textResult("Forward deleted.");
    }),
  );
}
