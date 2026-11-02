import type { CallToolResult } from "@modelcontextprotocol/server";
import { errorResult } from "./result.js";

/** What handlers get from the SDK's request context: cancelled when the client cancels the call. */
export interface ToolContext {
  signal: AbortSignal;
}

interface SdkContext {
  mcpReq: { signal: AbortSignal };
}

/** Converts a thrown error into a failed tool result instead of an uncaught rejection. */
export function toolHandler<Args>(
  handler: (args: Args, context: ToolContext) => Promise<CallToolResult>,
): (args: Args, context: SdkContext) => Promise<CallToolResult> {
  return async (args, context) => {
    try {
      return await handler(args, { signal: context.mcpReq.signal });
    } catch (error) {
      return errorResult(error);
    }
  };
}
