# domeneshop-mcp

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
