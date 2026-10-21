import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { destructive } from "../annotations.js";
import { ipListField } from "../fields.js";
import { textResult } from "../result.js";
import type { InferShape } from "../schema.js";
import { toolHandler } from "../tool.js";

const updateDynDNSShape = {
  hostname: z.string().describe("the fully qualified hostname to update, e.g. 'home.example.com'"),
  myip: ipListField.optional(),
};
type UpdateDynDNSArgs = InferShape<typeof updateDynDNSShape>;

export function registerDynDNSTools(server: McpServer, client: DomeneshopClient): void {
  server.registerTool(
    "update_dyndns",
    {
      description:
        "Point a hostname at the given (or the caller's apparent) IP address using Domeneshop's dynamic DNS protocol. " +
        "The record type (A or AAAA) follows from the address; a missing record is created, an existing one overwritten.",
      inputSchema: updateDynDNSShape,
      ...destructive("Update dynamic DNS"),
    },
    toolHandler<UpdateDynDNSArgs>(async ({ hostname, myip }, { signal }) => {
      await client.dynDns.update(hostname, myip, { signal });
      return textResult(
        myip
          ? `Dynamic DNS for ${hostname} updated to ${myip}.`
          : `Dynamic DNS for ${hostname} updated to the caller's apparent IP address.`,
      );
    }),
  );
}
