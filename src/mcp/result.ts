import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Marshals value as indented JSON and returns it as a tool text result. */
export function jsonResult(value: unknown): CallToolResult {
  return textResult(JSON.stringify(value, null, 2));
}

/** Wraps a plain string as a tool text result. */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

/** Wraps an error as a failed tool result, per the MCP convention of reporting tool failures via `isError`. */
export function errorResult(error: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}
