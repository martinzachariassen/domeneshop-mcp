import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * The MCP spec treats these as hints clients use to decide what may run
 * without asking the user, so every tool declares them explicitly instead of
 * relying on defaults.
 *
 * Each helper returns `{ title, annotations }` to spread into a tool config:
 * the title is set both at the top level (current spec) and inside the
 * annotations (older clients read it there). Every tool talks to the external
 * Domeneshop API, hence `openWorldHint: true` throughout.
 */
export interface ToolMeta {
  title: string;
  annotations: ToolAnnotations;
}

export function readOnly(title: string): ToolMeta {
  return {
    title,
    annotations: { title, readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  };
}

/** Creates something new without touching existing state; repeating it creates duplicates. */
export function additive(title: string): ToolMeta {
  return {
    title,
    annotations: {
      title,
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  };
}

/**
 * Overwrites or removes existing state. Most such calls are idempotent —
 * repeating them leaves the same end state — but pass `idempotent: false`
 * for ones that are not.
 */
export function destructive(title: string, options: { idempotent?: boolean } = {}): ToolMeta {
  return {
    title,
    annotations: {
      title,
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: options.idempotent ?? true,
      openWorldHint: true,
    },
  };
}
