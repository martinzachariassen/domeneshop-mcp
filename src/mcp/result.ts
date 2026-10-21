import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Returns the value as pretty-printed JSON text and, for plain objects, also
 * as `structuredContent` so clients that understand output schemas get typed data.
 */
export function jsonResult(value: unknown): CallToolResult {
  const result = textResult(JSON.stringify(value, null, 2));
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    result.structuredContent = value as Record<string, unknown>;
  }
  return result;
}

/**
 * `structuredContent` must be an object, so lists are wrapped under `key`
 * there. The text content stays the bare array to keep it compact.
 */
export function listResult(key: string, items: readonly unknown[]): CallToolResult {
  return {
    ...textResult(JSON.stringify(items, null, 2)),
    structuredContent: { [key]: items },
  };
}

export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

/** MCP convention: tool failures are reported via `isError`, not a thrown/rejected error. */
export function errorResult(error: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}
