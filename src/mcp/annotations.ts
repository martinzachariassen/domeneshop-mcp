import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Annotation presets. The MCP spec treats these as hints clients use to
 * decide what may run without asking the user, so every tool declares them
 * explicitly instead of relying on defaults.
 */

/** Marks a tool that only reads state. */
export function readOnly(): ToolAnnotations {
  return { readOnlyHint: true, idempotentHint: true };
}

/** Marks a tool that creates new state without replacing any. */
export function additive(): ToolAnnotations {
  return { destructiveHint: false };
}

/** Marks a tool that overwrites or removes existing state. Repeating the same call leaves the same result, hence idempotent. */
export function destructive(): ToolAnnotations {
  return { destructiveHint: true, idempotentHint: true };
}
