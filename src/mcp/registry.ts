import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** What the register*Tools functions need from the server: just registerTool. */
export type ToolRegistrar = Pick<McpServer, "registerTool">;

export interface ToolFilter {
  /** Skip every tool not annotated `readOnlyHint: true`. */
  readOnly?: boolean | undefined;
  /** When set, register only these tools. */
  tools?: ReadonlySet<string> | undefined;
  /** Never register these tools. */
  disabledTools?: ReadonlySet<string> | undefined;
}

/**
 * Wraps a server so tools excluded by the filter are never registered, which
 * hides them from tools/list and makes calls to them fail as unknown tools.
 * `names` maps every tool offered, registered or not, to whether it is
 * read-only, so callers can reject filter entries that match nothing.
 * `exposed` holds the tools that survived the filter.
 */
export function filteredRegistrar(
  server: McpServer,
  filter: ToolFilter,
): { registrar: ToolRegistrar; names: Map<string, boolean>; exposed: Set<string> } {
  const names = new Map<string, boolean>();
  const exposed = new Set<string>();
  const registerTool: McpServer["registerTool"] = (name, config, callback) => {
    const readOnly = config.annotations?.readOnlyHint === true;
    names.set(name, readOnly);
    const tool = server.registerTool(name, config, callback);
    if (isAllowed(name, readOnly, filter)) {
      exposed.add(name);
    } else {
      // Removing before connect sends no list_changed notification.
      tool.remove();
    }
    return tool;
  };
  return { registrar: { registerTool }, names, exposed };
}

function isAllowed(name: string, readOnly: boolean, filter: ToolFilter): boolean {
  if (filter.readOnly && !readOnly) {
    return false;
  }
  if (filter.tools && !filter.tools.has(name)) {
    return false;
  }
  return !filter.disabledTools?.has(name);
}

/** Throws when a filter names a tool that does not exist, which is almost always a typo. */
export function assertKnownTools(names: ReadonlyMap<string, boolean>, filter: ToolFilter): void {
  for (const [variable, list] of [
    ["DOMENESHOP_TOOLS", filter.tools],
    ["DOMENESHOP_DISABLED_TOOLS", filter.disabledTools],
  ] as const) {
    const unknown = [...(list ?? [])].filter((name) => !names.has(name));
    if (unknown.length > 0) {
      throw new Error(
        `${variable} names unknown tool(s): ${unknown.join(", ")}. Known tools: ${[...names.keys()].sort().join(", ")}`,
      );
    }
  }
}

/**
 * Explains filter combinations that quietly hide tools, e.g. an allowlisted
 * write tool in read-only mode, so a confused user finds the cause in the logs.
 */
export function filterWarnings(
  names: ReadonlyMap<string, boolean>,
  exposed: ReadonlySet<string>,
  filter: ToolFilter,
): string[] {
  const warnings: string[] = [];
  for (const name of filter.tools ?? []) {
    if (!names.has(name) || exposed.has(name)) {
      continue;
    }
    const reason = filter.disabledTools?.has(name)
      ? "DOMENESHOP_DISABLED_TOOLS also lists it"
      : "read-only mode hides tools that change the account";
    warnings.push(`${name} is listed in DOMENESHOP_TOOLS but is not exposed: ${reason}.`);
  }
  if (exposed.size === 0) {
    warnings.push(
      "no tools are exposed; check DOMENESHOP_READ_ONLY, DOMENESHOP_TOOLS and DOMENESHOP_DISABLED_TOOLS.",
    );
  }
  return warnings;
}
