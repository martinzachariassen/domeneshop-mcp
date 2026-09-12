import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { errorResult } from "./result.js";

/** Converts a thrown error into a failed tool result instead of an uncaught rejection. */
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
