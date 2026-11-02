import type { CallToolResult } from "@modelcontextprotocol/server";

/** Plain objects are also returned as `structuredContent`. */
export function jsonResult(value: unknown): CallToolResult {
  const result = textResult(JSON.stringify(value, null, 2));
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    result.structuredContent = value as Record<string, unknown>;
  }
  return result;
}

/** `structuredContent` must be an object, so the list is wrapped under `key` there only. */
export function listResult(key: string, items: readonly unknown[]): CallToolResult {
  return {
    ...textResult(JSON.stringify(items, null, 2)),
    structuredContent: { [key]: items },
  };
}

export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(error: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}
