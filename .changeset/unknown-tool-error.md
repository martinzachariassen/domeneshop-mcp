---
"domeneshop-mcp": patch
---

Note for 2.0.1: since the move to MCP SDK v2, calling a tool that does not exist or is hidden by `DOMENESHOP_READ_ONLY`, `DOMENESHOP_TOOLS` or `DOMENESHOP_DISABLED_TOOLS` returns the JSON-RPC error `-32602` (as the MCP specification describes) instead of a tool result with `isError`. The call is still refused without reaching the API.
