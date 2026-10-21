import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { additive, destructive, readOnly } from "../annotations.js";
import { domainIdField, forwardOutput, httpUrlField } from "../fields.js";
import type { ToolRegistrar } from "../registry.js";
import { jsonResult, listResult, textResult } from "../result.js";
import type { InferShape } from "../schema.js";
import { toolHandler } from "../tool.js";

const listForwardsShape = {
  domain_id: domainIdField,
};
type ListForwardsArgs = InferShape<typeof listForwardsShape>;

const getForwardShape = {
  domain_id: domainIdField,
  host: z
    .string()
    .describe("the host/subdomain the forward applies to, e.g. 'www' or '@' for the root"),
};
type GetForwardArgs = InferShape<typeof getForwardShape>;

const forwardShape = {
  domain_id: domainIdField,
  host: z.string().describe("the host/subdomain to forward, e.g. 'www' or '@' for the root"),
  url: httpUrlField,
  frame: z
    .boolean()
    .optional()
    .describe("if true, show the destination in a frame instead of redirecting; defaults to false"),
};
type ForwardArgs = InferShape<typeof forwardShape>;

const deleteForwardShape = {
  domain_id: domainIdField,
  host: z.string().describe("the host/subdomain whose forward should be deleted"),
};
type DeleteForwardArgs = InferShape<typeof deleteForwardShape>;

export function registerForwardTools(server: ToolRegistrar, client: DomeneshopClient): void {
  server.registerTool(
    "list_forwards",
    {
      description: "List all HTTP forwards configured for a domain.",
      inputSchema: listForwardsShape,
      outputSchema: { forwards: z.array(forwardOutput) },
      ...readOnly("List HTTP forwards"),
    },
    toolHandler<ListForwardsArgs>(async ({ domain_id }, { signal }) => {
      const forwards = await client.forwards.list(domain_id, { signal });
      return listResult("forwards", forwards);
    }),
  );

  server.registerTool(
    "get_forward",
    {
      description: "Get the HTTP forward configured for a specific host.",
      inputSchema: getForwardShape,
      outputSchema: forwardOutput,
      ...readOnly("Get HTTP forward"),
    },
    toolHandler<GetForwardArgs>(async ({ domain_id, host }, { signal }) => {
      const forward = await client.forwards.get(domain_id, host, { signal });
      return jsonResult(forward);
    }),
  );

  server.registerTool(
    "create_forward",
    {
      description:
        "Create a new HTTP forward for a domain. Fails if the host already has a forward or a conflicting A, AAAA, ANAME or CNAME record.",
      inputSchema: forwardShape,
      ...additive("Create HTTP forward"),
    },
    toolHandler<ForwardArgs>(async ({ domain_id, host, url, frame }, { signal }) => {
      const created = await client.forwards.create(
        domain_id,
        { host, url, frame: frame ?? false },
        { signal },
      );
      return jsonResult(created);
    }),
  );

  server.registerTool(
    "update_forward",
    {
      description:
        "Update an existing HTTP forward for a domain. Returns the stored forward. " +
        "frame is reset to false unless given.",
      inputSchema: forwardShape,
      ...destructive("Update HTTP forward"),
    },
    toolHandler<ForwardArgs>(async ({ domain_id, host, url, frame }, { signal }) => {
      const updated = await client.forwards.update(
        domain_id,
        host,
        { host, url, frame: frame ?? false },
        { signal },
      );
      return jsonResult(updated);
    }),
  );

  server.registerTool(
    "delete_forward",
    {
      description: "Delete an HTTP forward. This cannot be undone.",
      inputSchema: deleteForwardShape,
      ...destructive("Delete HTTP forward"),
    },
    toolHandler<DeleteForwardArgs>(async ({ domain_id, host }, { signal }) => {
      await client.forwards.delete(domain_id, host, { signal });
      return textResult(`Forward for host '${host}' deleted from domain ${String(domain_id)}.`);
    }),
  );
}
