import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function jsonResult(value: unknown): CallToolResult {
  return textResult(JSON.stringify(value, null, 2));
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
