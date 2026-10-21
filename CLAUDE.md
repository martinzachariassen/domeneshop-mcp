# CLAUDE.md

MCP server over the Domeneshop API (domains, DNS, HTTP forwards, dynamic DNS, invoices).
TypeScript, ESM, Node >= 20.3, stdio transport.

## Commands

```sh
npm run dev        # run from source (tsx)
npm run typecheck  # tsc --noEmit
npm run lint       # biome lint
npm run check      # biome lint + format, writes fixes
npm test           # vitest run
npm run build      # tsc -> dist
```

CI runs typecheck, lint, `format:check`, test and build on Node 20/22/24. A Husky
pre-commit hook runs `biome check` on staged files plus a full typecheck.

## Layout

Two layers, kept separate:

- `src/domeneshop/` — plain API client, no MCP types. `HttpTransport` does auth,
  query building and error mapping; one resource class per endpoint group under
  `resources/`, composed by `DomeneshopClient`.
- `src/mcp/` — MCP surface. One `register*Tools` function per resource in `tools/`,
  wired together in `server.ts`.

`src/index.ts` is the bin entry: parses flags, loads env config via `src/config.ts`
(credentials, read-only mode, tool allow/deny lists, timeout, debug), builds the
client and connects stdio. Tool filtering lives in `mcp/registry.ts`: register
functions take a `ToolRegistrar`, not the `McpServer` itself.

Imports use subpath aliases in tests only (`#domeneshop/*`, `#mcp/*`, `#testing/*`);
`src/` uses relative paths with explicit `.js` extensions.

## Conventions

- Every tool handler is wrapped in `toolHandler()` so thrown errors become
  `isError` results rather than rejections. Handlers receive `{ signal }` and
  must pass it to every client call so MCP cancellation aborts the request.
- Return values go through `jsonResult` / `listResult` / `textResult` from
  `mcp/result.ts`. Read-only tools declare an `outputSchema` (loose objects from
  `mcp/fields.ts`); lists are wrapped as `{ <plural>: [...] }`.
- Every tool spreads `...readOnly(title)`, `...additive(title)` or
  `...destructive(title)` from `mcp/annotations.ts` into its config, which sets
  the title and all annotation hints. Do not omit them.
- Reuse the shared fields in `mcp/fields.ts` (`domainIdField`, `ttlField`, …)
  and run `validateRecord()` from `mcp/records.ts` before any DNS write.
- Zod shapes are defined as objects and the arg type derived with `InferShape`.
  Every field gets a `.describe()` — the model relies on it, so mention required
  combinations (e.g. `priority` for MX/SRV) there.
- Tool names and arguments are `snake_case`; the client layer stays `camelCase`.
- tsconfig is strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`,
  so optional interface fields are written `foo?: T | undefined`.

## Tests

Vitest, `test/` mirroring `src/`. No fetch mocking: `test/support/testServer.ts`
starts a real `node:http` server on a random port and records requests, and
`mcpHarness.ts` connects a real MCP client to the server over `InMemoryTransport`.
Follow that pattern for new tests.

## Releases

Changesets. Any user-facing change needs `npx changeset` and the generated file
committed alongside it. Do not hand-edit `CHANGELOG.md` or the version in
`package.json`; the release workflow owns both. `npm run version` (used by the
release PR) also syncs the version into `server.json` (MCP Registry) and
`mcpb/manifest.json` (Claude Desktop bundle); `test/distribution.test.ts` fails if
they drift or if the manifest's tool list no longer matches the server. Adding
or renaming a tool means updating `mcpb/manifest.json` too.

After npm publish, `release.yml` runs `scripts/bump-homebrew-formula.sh`, which
opens an auto-merging PR in `martinzachariassen/homebrew-tap` updating the
formula's tarball `url` and `sha256` (needs the `HOMEBREW_TAP_TOKEN` secret).
The tap has no versioning of its own; never edit the formula by hand for a release.

## PRs and issues

Follow `.github/pull_request_template.md` when opening a PR — it has a checklist
for typecheck/lint/test, tests, README updates and changesets. Blank issues are
disabled; use the templates under `.github/ISSUE_TEMPLATE/` (bug report, feature
request, API coverage) or the security advisory link in `config.yml`.
