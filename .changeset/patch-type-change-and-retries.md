---
"domeneshop-mcp": patch
---

Fix DNS record patching and request retries:

- `patch_dns_record` no longer sends the old type's fields when it changes a record's type, e.g. an MX record patched to CNAME kept its `priority`.
- A `DELETE` whose first attempt got no response is now treated as done when a later retry gets 404, even if a retry in between failed with 502/503/504.
- Requests rate limited with 429 are now retried for creates (POST) too, since the API did not process them.
