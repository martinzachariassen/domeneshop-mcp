---
"domeneshop-mcp": major
---

**Breaking:** the npm package now exposes only the `domeneshop-mcp` command. Importing `domeneshop-mcp` used to start the MCP server as a side effect; it now fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, and the package no longer ships type declarations.
