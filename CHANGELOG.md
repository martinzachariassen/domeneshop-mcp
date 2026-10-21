# domeneshop-mcp

## 1.1.1

### Patch Changes

- [#37](https://github.com/martinzachariassen/domeneshop-mcp/pull/37) [`d24cf89`](https://github.com/martinzachariassen/domeneshop-mcp/commit/d24cf89e1f90d4db3f6d6ff4f28d732e19700224) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - Install with Homebrew: `brew install martinzachariassen/tap/domeneshop-mcp`. Every release now also updates the Homebrew tap.

## 1.1.0

### Minor Changes

- [#34](https://github.com/martinzachariassen/domeneshop-mcp/pull/34) [`511a6e9`](https://github.com/martinzachariassen/domeneshop-mcp/commit/511a6e948ec7a8ab0e6b7eb78f9bd7182d082281) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - Add access control and CLI polish. `DOMENESHOP_READ_ONLY` exposes only read-only tools, `DOMENESHOP_TOOLS` / `DOMENESHOP_DISABLED_TOOLS` allow- or deny-list individual tools (misspelled names fail at startup), `DOMENESHOP_TIMEOUT_MS` sets the request timeout and `DOMENESHOP_DEBUG` logs API requests to stderr. The CLI gains `--help`, rejects unknown arguments with exit code 2, trims whitespace around credentials and shuts down cleanly on SIGINT/SIGTERM.

- [#34](https://github.com/martinzachariassen/domeneshop-mcp/pull/34) [`7c690b3`](https://github.com/martinzachariassen/domeneshop-mcp/commit/7c690b38aed2ab85a73e8cf62403f70eb476cc0a) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - Add two DNS helper tools:
  
  - `patch_dns_record` changes only the fields you pass. It reads the record first, so `ttl`, `priority` and the other fields are no longer reset by accident the way they can be with `update_dns_record`.
  - `upsert_dns_record` updates the single record for a host and type, or creates it if there is none. When the host has several records of that type (common for MX and TXT), it refuses and lists their IDs instead of guessing.

- [#34](https://github.com/martinzachariassen/domeneshop-mcp/pull/34) [`872be45`](https://github.com/martinzachariassen/domeneshop-mcp/commit/872be455fcfb4e4ea279ddd2478e0f6d498353eb) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - Polish the MCP surface:
  
  - Every tool now has a human-readable title and the `openWorldHint` annotation, and the server sends usage instructions on initialize.
  - Inputs are validated before anything reaches Domeneshop: TTL range and multiple of 60, `http(s)` forward URLs, IP addresses for dynamic DNS (now including comma-separated IPv4/IPv6 lists), enums for the `list_dns_records` type and `list_invoices` status filters, and the fields each record type requires (e.g. `priority` for MX).
  - Read-only tools declare an `outputSchema` and return `structuredContent`; lists are wrapped as `{ domains }`, `{ records }`, `{ forwards }` and `{ invoices }` there, while the text content stays the plain array.
  - `create_dns_record` and `update_dns_record` return the record as stored instead of just an ID or a confirmation, and delete/dyndns messages say what was changed.
  - Cancelling a tool call from the client now aborts the underlying API request.

- [#34](https://github.com/martinzachariassen/domeneshop-mcp/pull/34) [`1727632`](https://github.com/martinzachariassen/domeneshop-mcp/commit/17276320bb0447a5e54f5bed251a652a041f372d) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - Make the API client more robust: requests now time out after 30 seconds, `GET`/`PUT`/`DELETE` are retried on 429/502/503/504 and network errors (honouring `Retry-After`, never retrying `POST`), a `User-Agent` header identifies the server, and error messages explain common statuses (401/403/404/409/429/5xx) with HTML bodies stripped and long bodies truncated. Network failures and timeouts surface as `DomeneshopNetworkError`. Node 20.3 or newer is now required.

### Patch Changes

- [#34](https://github.com/martinzachariassen/domeneshop-mcp/pull/34) [`855be46`](https://github.com/martinzachariassen/domeneshop-mcp/commit/855be46840521455ec79ceb9755b016506841b9c) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - Publish to the official MCP Registry as `io.github.martinzachariassen/domeneshop-mcp` and attach a one-click Claude Desktop bundle (`.mcpb`) to each GitHub Release. The package is now published with `publishConfig` (public, provenance) and requires at least the MCP SDK and zod versions it is tested against.

- [#34](https://github.com/martinzachariassen/domeneshop-mcp/pull/34) [`87163b5`](https://github.com/martinzachariassen/domeneshop-mcp/commit/87163b52dd897ee4f598fe25f825ccb55d8cee6e) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - `update_dyndns` now tells the model it can update several comma-separated hostnames in one call, as the Domeneshop API allows. The `Invoice` type marks `due_date` and `paid_date` as nullable, matching what the API returns for unpaid invoices.

- [#34](https://github.com/martinzachariassen/domeneshop-mcp/pull/34) [`7f86965`](https://github.com/martinzachariassen/domeneshop-mcp/commit/7f86965e1fad7f949f728b472c863e210f5ee540) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - Fixes from a review pass:
  
  - `update_dyndns` strips spaces around commas in `hostname` and `myip` before calling the API, and treats an empty `myip` as omitted.
  - `upsert_dns_record` keeps the stored `ttl`, `priority` and other optional fields when it updates an existing record and they are left out, instead of resetting them.
  - A create that times out or loses its connection now says it may still have been applied, so the model checks before retrying and does not create a duplicate.
  - A `DELETE` retried after a lost connection treats a `404` as success, since the first attempt already removed the resource.
  - The server logs a warning when the tool filters hide an allowlisted tool (e.g. a write tool in read-only mode) or leave no tools at all.
  - Clearer messages for a `412` from the forwards API and for `update_forward`, which cannot change a forward's host.

- [#34](https://github.com/martinzachariassen/domeneshop-mcp/pull/34) [`a584d13`](https://github.com/martinzachariassen/domeneshop-mcp/commit/a584d1344ecba45f60526b15b42dd0708e0c1ac1) Thanks [@martinzachariassen](https://github.com/martinzachariassen)! - Require `@modelcontextprotocol/sdk` 1.32.1 or newer, which fixes several security advisories (GHSA-22jm-h49p-29qw, GHSA-6prh-2h8m-c8cw, GHSA-46jr-4wx8-v453, GHSA-rvq5-wwqv-78pq).

## 1.0.4

### Patch Changes

- Update dependencies, including `@modelcontextprotocol/sdk` 1.31.0 and zod 4.6, and resolve npm audit advisories in transitive dependencies.

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
