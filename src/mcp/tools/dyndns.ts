import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { destructive } from "../annotations.js";
import { hostnameList, hostnameListField, ipListField, joinList, splitList } from "../fields.js";
import type { ToolRegistrar } from "../registry.js";
import { textResult } from "../result.js";
import { toolHandler } from "../tool.js";

export function registerDynDNSTools(server: ToolRegistrar, client: DomeneshopClient): void {
  server.registerTool(
    "update_dyndns",
    {
      description:
        "Point one or more hostnames at the given (or the caller's apparent) IP address using Domeneshop's dynamic DNS protocol. " +
        "The record type (A or AAAA) follows from the address; a missing record is created, an existing one overwritten.",
      inputSchema: z.object({
        hostname: hostnameListField,
        myip: ipListField.optional(),
      }),
      ...destructive("Update dynamic DNS"),
    },
    toolHandler(async (args, { signal }) => {
      const hostname = joinList(hostnameList(args.hostname));
      const myip = joinList(splitList(args.myip ?? "")) || undefined;
      await client.dynDns.update(hostname, myip, { signal });
      return textResult(
        myip
          ? `Dynamic DNS for ${hostname} updated to ${myip}.`
          : `Dynamic DNS for ${hostname} updated to the caller's apparent IP address.`,
      );
    }),
  );
}
