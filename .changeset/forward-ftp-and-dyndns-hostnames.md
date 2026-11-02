---
"domeneshop-mcp": patch
---

Align tool input with Domeneshop's OpenAPI spec:

- `create_forward` and `update_forward` accept `ftp://` destinations, which the API supports, in addition to `http://` and `https://`.
- `update_dyndns` checks that each hostname is a valid hostname, and sends it the way the API expects: without a trailing dot, and as punycode for internationalised names (e.g. `blåbær.no`).
