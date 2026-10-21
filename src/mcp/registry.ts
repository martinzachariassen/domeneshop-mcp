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
 * `names` collects every tool offered, registered or not, so callers can
 * reject filter entries that match nothing.
 */
export function filteredRegistrar(
  server: McpServer,
  filter: ToolFilter,
): { registrar: ToolRegistrar; names: Set<string> } {
  const names = new Set<string>();
  const registerTool: McpServer["registerTool"] = (name, config, callback) => {
    names.add(name);
    const tool = server.registerTool(name, config, callback);
    if (!isAllowed(name, config.annotations?.readOnlyHint === true, filter)) {
      // Removing before connect sends no list_changed notification.
      tool.remove();
    }
    return tool;
  };
  return { registrar: { registerTool }, names };
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
export function assertKnownTools(names: ReadonlySet<string>, filter: ToolFilter): void {
  for (const [variable, list] of [
    ["DOMENESHOP_TOOLS", filter.tools],
    ["DOMENESHOP_DISABLED_TOOLS", filter.disabledTools],
  ] as const) {
    const unknown = [...(list ?? [])].filter((name) => !names.has(name));
    if (unknown.length > 0) {
      throw new Error(
        `${variable} names unknown tool(s): ${unknown.join(", ")}. Known tools: ${[...names].sort().join(", ")}`,
      );
    }
  }
}
