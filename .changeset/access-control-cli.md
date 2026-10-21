---
"domeneshop-mcp": minor
---

Add access control and CLI polish. `DOMENESHOP_READ_ONLY` exposes only read-only tools, `DOMENESHOP_TOOLS` / `DOMENESHOP_DISABLED_TOOLS` allow- or deny-list individual tools (misspelled names fail at startup), `DOMENESHOP_TIMEOUT_MS` sets the request timeout and `DOMENESHOP_DEBUG` logs API requests to stderr. The CLI gains `--help`, rejects unknown arguments with exit code 2, trims whitespace around credentials and shuts down cleanly on SIGINT/SIGTERM.
