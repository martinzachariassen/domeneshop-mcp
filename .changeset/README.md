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

At release time, the maintainer runs:

```sh
npx changeset version
```

which consumes all pending changeset files, bumps `package.json`'s version,
and writes the corresponding entries into `CHANGELOG.md`. The version bump is
then committed, tagged (`git tag vX.Y.Z`), and pushed — which triggers the
`release` workflow to publish to npm.
