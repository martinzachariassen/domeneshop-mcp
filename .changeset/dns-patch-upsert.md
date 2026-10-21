---
"domeneshop-mcp": minor
---

Add two DNS helper tools:

- `patch_dns_record` changes only the fields you pass. It reads the record first, so `ttl`, `priority` and the other fields are no longer reset by accident the way they can be with `update_dns_record`.
- `upsert_dns_record` updates the single record for a host and type, or creates it if there is none. When the host has several records of that type (common for MX and TXT), it refuses and lists their IDs instead of guessing.
