import type { McpServer } from "@modelcontextprotocol/server";

export type ToolRegistrar = Pick<McpServer, "registerTool">;

export interface ToolFilter {
  readOnly?: boolean | undefined;
  tools?: ReadonlySet<string> | undefined;
  disabledTools?: ReadonlySet<string> | undefined;
}

/**
 * Hides tools excluded by the filter, so calls to them fail as unknown tools.
 * Hidden tools are registered and then removed, which before `connect` sends
 * no `list_changed` notification. `names` maps every tool offered, hidden or
 * not, to whether it is read-only.
 *
 * `registerTool` is overloaded, so the wrapper spreads the parameters of one
 * overload and casts back to the full type.
 */
export function filteredRegistrar(
  server: McpServer,
  filter: ToolFilter,
): { registrar: ToolRegistrar; names: Map<string, boolean>; exposed: Set<string> } {
  const names = new Map<string, boolean>();
  const exposed = new Set<string>();
  const registerTool = ((...args: Parameters<McpServer["registerTool"]>) => {
    const [name, config] = args;
    const readOnly = config.annotations?.readOnlyHint === true;
    names.set(name, readOnly);
    const tool = server.registerTool(...args);
    if (isAllowed(name, readOnly, filter)) {
      exposed.add(name);
    } else {
      tool.remove();
    }
    return tool;
  }) as McpServer["registerTool"];
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

/** Throws when a filter names an unknown tool, which is almost always a typo. */
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

/** Explains filter combinations that quietly hide tools, e.g. an allowlisted write tool in read-only mode. */
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
