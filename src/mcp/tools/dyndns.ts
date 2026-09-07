import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { destructive } from "../annotations.js";
import { textResult } from "../result.js";
import type { InferShape } from "../schema.js";
import { toolHandler } from "../tool.js";

const updateDynDNSShape = {
  hostname: z.string().describe("the hostname to update, must have an existing A or AAAA record"),
  myip: z
    .string()
    .optional()
    .describe("the IP address to set; if omitted, Domeneshop uses the caller's apparent IP"),
};
type UpdateDynDNSArgs = InferShape<typeof updateDynDNSShape>;

export function registerDynDNSTools(server: McpServer, client: DomeneshopClient): void {
  server.registerTool(
    "update_dyndns",
    {
      description:
        "Update a hostname's DNS record to point at the given (or caller's apparent) IP address, using Domeneshop's dynamic DNS protocol.",
      inputSchema: updateDynDNSShape,
      annotations: destructive(),
    },
    toolHandler<UpdateDynDNSArgs>(async ({ hostname, myip }) => {
      await client.dynDns.update(hostname, myip);
      return textResult("Dynamic DNS record updated.");
    }),
  );
}
