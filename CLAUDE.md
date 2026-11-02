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
npm run test:coverage  # with the 90 % coverage thresholds CI enforces
npm run test:e2e   # opt-in, against the live API (see Tests)
npm run spec:check # compare Domeneshop's published OpenAPI spec with the fixture
npm run build      # tsc -> dist
```

CI runs typecheck, lint, `format:check`, `test:coverage` and build on Node 20/22/24. A Husky
pre-commit hook runs `biome check` on staged files plus a full typecheck.

## Layout

Two layers, kept separate:

- `src/domeneshop/` — plain API client, no MCP types. `HttpTransport` does auth,
  query building and error mapping; one resource class per endpoint group under
  `resources/`, composed by `DomeneshopClient`.
- `src/mcp/` — MCP surface. One `register*Tools` function per resource in `tools/`,
  wired together in `server.ts`. Shared input fields are in `fields.ts`, and DNS
  record handling (`pickRecord`, `mergeRecord`, `validateRecord`) is in `records.ts`.

The package publishes only the `domeneshop-mcp` bin (`"exports": {}`); nothing in
`src/` is a public API.

`src/cli.ts` holds the CLI: parses flags, loads env config via `src/config.ts`
(credentials, read-only mode, tool allow/deny lists, timeout, debug), builds the
client and connects. All process access goes through an injected `CliIO`, so
it runs in-process under test; `src/index.ts` is only the bin shim that wires
it to stdio and `process`. Tool filtering lives in `mcp/registry.ts`: register
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
- Reuse the shared fields in `mcp/fields.ts` (`domainIdField`, `hostField`,
  `uintField`, `ttlField`, …) and run `validateRecord()` from `mcp/records.ts`
  before any DNS write.
- All tool input is validated before it reaches the API: the Zod shape handles
  single fields (IDs positive integers, ranges, enums, non-blank strings) and
  `validateRecord()` the rules that span fields. Every rule needs a case in
  `test/mcp/validation.test.ts`, which asserts `isError` and zero API requests;
  new tools must be added to its `VALID` map.
- Zod shapes are defined as objects and the arg type derived with `InferShape`.
  Every field gets a `.describe()` — the model relies on it, so mention required
  combinations (e.g. `priority` for MX/SRV) there.
- Tool names and arguments are `snake_case`; the client layer stays `camelCase`.
- Keep comments to a minimum. Use JSDoc (`/** */`) on functions, classes and
  exports only when the name and types don't already say it: the *why*, a
  non-obvious contract, an undocumented API quirk. Use `//` only for code that
  is genuinely hard to follow. Never restate what the code does.
- tsconfig is strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`,
  so optional interface fields are written `foo?: T | undefined`.

## Tests

Vitest, `test/` mirroring `src/`. No fetch mocking: `test/support/testServer.ts`
starts a real `node:http` server on a random port and records requests, and
`mcpHarness.ts` connects a real MCP client to the server over `InMemoryTransport`.
Use `withTestServer` / `withHarness` from `test/support/` rather than writing
`try/finally` cleanup by hand. Tool tests live in `test/mcp/tools/<resource>.test.ts`,
next to the `src/mcp/tools/` file they cover; cross-cutting input validation
lives in `test/mcp/validation.test.ts`. `test/index.test.ts` only covers what needs
a real process (exit codes, stdio, signals); test CLI behaviour in `test/cli.test.ts`.

`test/contract/` checks the client against Domeneshop's OpenAPI spec, stored in
`test/contract/domeneshop-openapi.json`. `specServer.ts` is a fake API that
validates every request (path, path and query parameters, auth, body) and
answers with the documented success response, which is also validated. Every
spec operation and documented error status has a contract test, and so does
every MCP tool. A guard test fails when the spec gains an operation that no
test reaches. What the spec omits but the API supports (ANAME/CAA/DS/NS
records, the `POST /forwards/` body) is in the overlay in
`test/contract/openapi.ts`, with a source. Do not edit the fixture by hand:
`npm run spec:update` refreshes it, and the weekly `spec-drift` workflow opens
an issue when the published spec changes.

Coverage thresholds are 90 % for statements, branches, functions and lines.
Do not lower them.

`test/e2e/` runs against the real API only when `DOMENESHOP_E2E_TOKEN`,
`DOMENESHOP_E2E_SECRET` and `DOMENESHOP_E2E_DOMAIN_ID` are set, so never in CI.
It creates and deletes a temporary TXT record and forward on that domain.

## Releases

Changesets. Any user-facing change needs `npx changeset` and the generated file
committed alongside it. Do not hand-edit `CHANGELOG.md` or the version in
`package.json`; the release workflow owns both. `npm run version` (used by the
release PR) also syncs the version into `server.json` (MCP Registry) and
`mcpb/manifest.json` (Claude Desktop bundle); `test/distribution.test.ts` fails if
they drift or if the manifest's tool list no longer matches the server. Adding
or renaming a tool means updating `mcpb/manifest.json` too.

Merging the release PR is the only manual step. `release-pr.yml` then tags
`vX.Y.Z`, and `release.yml` publishes to npm, the MCP Registry and a GitHub
Release (npm tarball + `.mcpb`, plus SLSA provenance from a second
`provenance` job; OpenSSF Scorecard's Signed-Releases check reads it), then
runs `scripts/bump-homebrew-formula.sh`, which opens an auto-merging PR in `martinzachariassen/homebrew-tap` updating the formula's
tarball `url` and `sha256`. The tap has no versioning of its own; never edit the
formula by hand for a release.

Both workflows write with a token from one GitHub App installed on both repos
(`HOMEBREW_APP_CLIENT_ID` variable + `HOMEBREW_APP_PRIVATE_KEY` secret), not
`GITHUB_TOKEN` or a PAT: App commits are signed (both repos require signatures),
and App PRs and tags trigger workflows, which `GITHUB_TOKEN`'s do not.

## PRs and issues

Follow `.github/pull_request_template.md` when opening a PR — it has a checklist
for typecheck/lint/test, tests, README updates and changesets. Blank issues are
disabled; use the templates under `.github/ISSUE_TEMPLATE/` (bug report, feature
request, API coverage) or the security advisory link in `config.yml`.
