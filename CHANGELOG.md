# domeneshop-mcp

## 1.0.3

### Patch Changes

- [#11](https://github.com/martinzachariassen/domeneshop-mcp/pull/11) [`fe54cb3`](https://github.com/martinzachariassen/domeneshop-mcp/commit/fe54cb30944801983814540dc4489372308d9a90) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - Refresh README structure and trim non-essential comments across the codebase.

## 1.0.2

### Patch Changes

- [#10](https://github.com/martinzachariassen/domeneshop-mcp/pull/10) [`c21008b`](https://github.com/martinzachariassen/domeneshop-mcp/commit/c21008bf12dd1c9f60aa434439dcddca3b59d499) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - Document that this is a standard MCP server usable with any MCP-compatible client, not just Claude, and add setup instructions for Claude Desktop, Cursor, VS Code, Codex and other clients alongside Claude Code.

## 1.0.1

### Patch Changes

- Make the release workflow idempotent: skip `npm publish` when the current
  version is already on the registry instead of failing the run.

## 1.0.0

Initial public release: an MCP server exposing the Domeneshop API (domains,
DNS records, HTTP forwards, dynamic DNS and invoices) as 15 tools.

Future releases are documented here automatically by
[Changesets](https://github.com/changesets/changesets) — see
`.changeset/README.md` for the workflow.
