# Changesets

This directory is used by [Changesets](https://github.com/changesets/changesets)
to manage the changelog and version bumps for this package.

When you make a change that should be called out in the changelog (a new
feature, a fix, a breaking change), run:

```sh
npx changeset
```

and follow the prompts. This writes a small markdown file here describing the
change and its semver bump (patch/minor/major); commit it alongside your PR.

While changesets are pending on `main`, the `release-pr` workflow keeps a
"chore: release" PR open. It runs `npm run version`, which consumes the
changeset files, bumps the version in `package.json`, `server.json` and
`mcpb/manifest.json`, and writes the entries into `CHANGELOG.md`.

After merging that PR, the maintainer tags the merge commit and pushes the tag:

```sh
git tag vX.Y.Z && git push --tags
```

That triggers the `release` workflow, which publishes to npm and the MCP
Registry and attaches the Claude Desktop bundle (`.mcpb`) to the GitHub Release.
