# Contributing

Issues and pull requests are welcome.

## Setup

```sh
npm install
```

This also installs a Git pre-commit hook (via Husky) that runs Biome on
staged files and type-checks the project before each commit.

## Workflow

```sh
npm run dev          # run the server from source with tsx
npm run typecheck    # type-check without emitting
npm run lint         # lint with Biome
npm run format       # format with Biome
npm test             # run the test suite (vitest)
npm run test:coverage # with the 90 % coverage thresholds CI enforces
npm run build        # compile to ./dist
```

Please keep `npm run typecheck`, `npm run lint` and `npm test` clean on
anything you touch — CI checks all three, plus formatting and a build, on
every push and pull request.

## Testing against the Domeneshop API

`test/contract/` validates every request and response against Domeneshop's
OpenAPI spec, stored in `test/contract/domeneshop-openapi.json`. To check
whether the published spec has changed, or to refresh the stored copy:

```sh
npm run spec:check
npm run spec:update
```

To test against the live API, use credentials for an account with a domain you
can experiment on. The suite reads the account and creates, changes and
deletes a temporary `_mcp-e2e-*` TXT record and `mcp-e2e-*` forward on that
domain:

```sh
DOMENESHOP_E2E_TOKEN=... DOMENESHOP_E2E_SECRET=... DOMENESHOP_E2E_DOMAIN_ID=123 \
  npm run test:e2e
```

Without those variables the suite is skipped.

## Changelog entries

This project uses [Changesets](https://github.com/changesets/changesets) to
generate `CHANGELOG.md` and version bumps. If your change is
user-facing (a new tool, a fix, a behavior change), add a changeset:

```sh
npx changeset
```

Follow the prompts and commit the generated file in `.changeset/` along with
your change. See `.changeset/README.md` for details on how releases consume
these files.
