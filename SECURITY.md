# Security Policy

## Supported versions

Only the latest published version of `domeneshop-mcp` on npm is supported with
security fixes. Please upgrade before reporting an issue.

## Reporting a vulnerability

If you believe you've found a security vulnerability in this project, please
**do not open a public GitHub issue**. Instead, report it privately via
[GitHub Security Advisories](https://github.com/martinzachariassen/domeneshop-mcp/security/advisories/new).

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, or a minimal proof of concept.
- The affected version(s).

You should expect an initial response within a few days. This is a
personal, unfunded open-source project, so there is no guaranteed fix
timeline, but valid reports will be addressed as soon as reasonably possible
and credited in the release notes unless you prefer otherwise.

## Verifying releases

Releases are built and published by GitHub Actions only, never from a
maintainer's machine.

- The npm package is published with
  [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
  so `npm audit signatures` verifies it.
- Each [GitHub Release](https://github.com/martinzachariassen/domeneshop-mcp/releases)
  attaches the npm tarball, the Claude Desktop bundle (`.mcpb`) and SLSA
  level 3 provenance for both (`multiple.intoto.jsonl`). Verify a file with
  [slsa-verifier](https://github.com/slsa-framework/slsa-verifier):

  ```sh
  slsa-verifier verify-artifact domeneshop-mcp-X.Y.Z.tgz \
    --provenance-path multiple.intoto.jsonl \
    --source-uri github.com/martinzachariassen/domeneshop-mcp \
    --source-tag vX.Y.Z
  ```

## Scope notes

This server holds your Domeneshop API token and secret (read from
`DOMENESHOP_API_TOKEN` / `DOMENESHOP_API_SECRET`) and uses them to call the
Domeneshop API on your behalf over HTTPS. It does not store, log, or transmit
those credentials anywhere else, including in `DOMENESHOP_DEBUG` output.
To limit what an assistant can do with them, see the
[Access control](README.md#access-control) section of the README.

Vulnerabilities in the upstream
[Domeneshop API](https://api.domeneshop.no/docs/) itself are out of scope —
please report those to Domeneshop directly.
