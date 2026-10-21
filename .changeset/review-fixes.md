---
"domeneshop-mcp": patch
---

Fixes from a review pass:

- `update_dyndns` strips spaces around commas in `hostname` and `myip` before calling the API, and treats an empty `myip` as omitted.
- `upsert_dns_record` keeps the stored `ttl`, `priority` and other optional fields when it updates an existing record and they are left out, instead of resetting them.
- A create that times out or loses its connection now says it may still have been applied, so the model checks before retrying and does not create a duplicate.
- A `DELETE` retried after a lost connection treats a `404` as success, since the first attempt already removed the resource.
- The server logs a warning when the tool filters hide an allowlisted tool (e.g. a write tool in read-only mode) or leave no tools at all.
- Clearer messages for a `412` from the forwards API and for `update_forward`, which cannot change a forward's host.
