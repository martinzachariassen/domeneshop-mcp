import { z } from "zod";
import type { DomeneshopClient } from "../../domeneshop/index.js";
import { destructive } from "../annotations.js";
import { ipListField } from "../fields.js";
import type { ToolRegistrar } from "../registry.js";
import { textResult } from "../result.js";
import type { InferShape } from "../schema.js";
import { toolHandler } from "../tool.js";

const updateDynDNSShape = {
  hostname: z
    .string()
    .min(1)
    .describe(
      "the fully qualified hostname to update, e.g. 'home.example.com'; several hostnames can be updated at once by separating them with commas",
    ),
  myip: ipListField.optional(),
};
type UpdateDynDNSArgs = InferShape<typeof updateDynDNSShape>;

export function registerDynDNSTools(server: ToolRegistrar, client: DomeneshopClient): void {
  server.registerTool(
    "update_dyndns",
    {
      description:
        "Point one or more hostnames at the given (or the caller's apparent) IP address using Domeneshop's dynamic DNS protocol. " +
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
