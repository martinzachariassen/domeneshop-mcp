#!/usr/bin/env bash
# Opens a PR in the Homebrew tap that points the formula at the npm tarball for
# the current package.json version, then enables auto-merge on it so it lands
# once the tap's test-bot checks pass. Runs from release.yml after npm publish.
#
# Everything goes through the GitHub API (no git push), so the commit is signed
# by GitHub and satisfies the tap's required-signatures rule.
#
# Env:
#   GH_TOKEN      token with Contents + Pull requests write on the tap (required)
#   TAP_REPO      default: martinzachariassen/homebrew-tap
#   FORMULA_PATH  default: Formula/<package name>.rb
#   VERSION       default: version from package.json
#   AUTO_MERGE    default: true; set to false to leave the PR open
set -euo pipefail

if [ -z "${GH_TOKEN:-}" ]; then
  echo "GH_TOKEN is not set: add the HOMEBREW_TAP_TOKEN secret to bump the Homebrew tap." >&2
  exit 1
fi

name="$(node -p "require('./package.json').name")"
version="${VERSION:-$(node -p "require('./package.json').version")}"
tap="${TAP_REPO:-martinzachariassen/homebrew-tap}"
formula="${FORMULA_PATH:-Formula/${name}.rb}"
url="https://registry.npmjs.org/${name}/-/${name}-${version}.tgz"
branch="bump-${name}-${version}"

current="$(gh api "repos/${tap}/contents/${formula}" --jq .content | base64 --decode)"
if grep -qF "url \"${url}\"" <<<"$current"; then
  echo "${formula} already points at ${version}, nothing to do."
  exit 0
fi

open_pr="$(gh pr list --repo "$tap" --head "$branch" --state open --json url --jq '.[0].url // ""')"
if [ -n "$open_pr" ]; then
  echo "Bump PR for ${version} is already open: ${open_pr}"
  exit 0
fi

sha256="$(curl -fsSL "$url" | shasum -a 256 | cut -d' ' -f1)"
updated="$(sed -E \
  -e "s|^  url \".*\"$|  url \"${url}\"|" \
  -e "s|^  sha256 \".*\"$|  sha256 \"${sha256}\"|" <<<"$current")"

if ! grep -qF "sha256 \"${sha256}\"" <<<"$updated"; then
  echo "Could not rewrite url/sha256 in ${formula}." >&2
  exit 1
fi

base_sha="$(gh api "repos/${tap}/git/ref/heads/main" --jq .object.sha)"
file_sha="$(gh api "repos/${tap}/contents/${formula}?ref=main" --jq .sha)"

# Reset the branch if a previous run left it behind without an open PR.
if gh api "repos/${tap}/git/ref/heads/${branch}" >/dev/null 2>&1; then
  gh api -X PATCH "repos/${tap}/git/refs/heads/${branch}" -f sha="$base_sha" -F force=true >/dev/null
else
  gh api "repos/${tap}/git/refs" -f ref="refs/heads/${branch}" -f sha="$base_sha" >/dev/null
fi

gh api -X PUT "repos/${tap}/contents/${formula}" \
  -f message="${name} ${version}" \
  -f content="$(printf '%s\n' "$updated" | base64 | tr -d '\n')" \
  -f sha="$file_sha" \
  -f branch="$branch" >/dev/null

pr_url="$(gh pr create --repo "$tap" --base main --head "$branch" \
  --title "${name} ${version}" \
  --body "Bumps \`${name}\` to [${version}](https://github.com/${GITHUB_REPOSITORY:-martinzachariassen/${name}}/releases/tag/v${version}).

Opened automatically by the ${name} release workflow.")"
echo "Opened ${pr_url}"

if [ "${AUTO_MERGE:-true}" = "true" ]; then
  gh pr merge --repo "$tap" --auto --squash "$pr_url"
  echo "Auto-merge enabled: it merges once the tap's checks pass."
fi
