# CLAUDE.md

MCP server over the Domeneshop API (domains, DNS, HTTP forwards, dynamic DNS, invoices).
TypeScript, ESM, Node >= 20, stdio transport.

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

`src/index.ts` is the bin entry: reads `DOMENESHOP_API_TOKEN` / `DOMENESHOP_API_SECRET`,
builds the client, connects stdio.

Imports use subpath aliases in tests only (`#domeneshop/*`, `#mcp/*`, `#testing/*`);
`src/` uses relative paths with explicit `.js` extensions.

## Conventions

- Every tool handler is wrapped in `toolHandler()` so thrown errors become
  `isError` results rather than rejections.
- Return values go through `jsonResult` / `textResult` from `mcp/result.ts`.
- Every tool declares annotations explicitly via `readOnly()`, `additive()` or
  `destructive()` from `mcp/annotations.ts`. Do not omit them.
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
`package.json`; the release workflow owns both.
