import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { errorResult } from "./result.js";

/** The part of the SDK's request context handlers use: cancelled when the client cancels the call. */
export interface ToolContext {
  signal: AbortSignal;
}

/** Converts a thrown error into a failed tool result instead of an uncaught rejection. */
export function toolHandler<Args>(
  handler: (args: Args, context: ToolContext) => Promise<CallToolResult>,
): (args: Args, context: ToolContext) => Promise<CallToolResult> {
  return async (args, context) => {
    try {
      return await handler(args, { signal: context.signal });
    } catch (error) {
      return errorResult(error);
    }
  };
}
