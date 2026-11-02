---
"domeneshop-mcp": minor
---

The DNS and forward tools that create or change something (`create_dns_record`, `update_dns_record`, `patch_dns_record`, `upsert_dns_record`, `create_forward`, `update_forward`) now declare an output schema, so clients get typed structured results from them as they already did from the read-only tools.
