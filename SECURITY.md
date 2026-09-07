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

## Scope notes

This server holds your Domeneshop API token and secret (read from
`DOMENESHOP_API_TOKEN` / `DOMENESHOP_API_SECRET`) and uses them to call the
Domeneshop API on your behalf over HTTPS. It does not store, log, or transmit
those credentials anywhere else. Vulnerabilities in the upstream
[Domeneshop API](https://api.domeneshop.no/docs/) itself are out of scope —
please report those to Domeneshop directly.
