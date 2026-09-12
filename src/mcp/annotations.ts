import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * The MCP spec treats these as hints clients use to decide what may run
 * without asking the user, so every tool declares them explicitly instead of
 * relying on defaults.
 */

export function readOnly(): ToolAnnotations {
  return { readOnlyHint: true, idempotentHint: true };
}

export function additive(): ToolAnnotations {
  return { destructiveHint: false };
}

/** Repeating the same destructive call leaves the same end state, hence idempotent. */
export function destructive(): ToolAnnotations {
  return { destructiveHint: true, idempotentHint: true };
}
