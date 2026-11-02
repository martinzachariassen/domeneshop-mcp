---
"domeneshop-mcp": patch
---

Move to the split MCP TypeScript SDK v2 (`@modelcontextprotocol/server`). The server no longer installs the HTTP, OAuth and Express dependencies of the v1 SDK, which it never used over stdio: a production install drops from 94 packages to 3. Tool schemas now declare JSON Schema draft 2020-12, the MCP default.
