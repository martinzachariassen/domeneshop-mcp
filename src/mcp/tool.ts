import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { errorResult } from "./result.js";

/**
 * Wraps a tool handler so that a thrown error (a `DomeneshopApiError` or
 * otherwise) becomes a failed tool result instead of an uncaught rejection.
 */
export function toolHandler<Args>(
  handler: (args: Args) => Promise<CallToolResult>,
): (args: Args) => Promise<CallToolResult> {
  return async (args) => {
    try {
      return await handler(args);
    } catch (error) {
      return errorResult(error);
    }
  };
}
