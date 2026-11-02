---
"domeneshop-mcp": patch
---

Fix `list_dns_records`, `get_dns_record` and the DNS write tools failing with an output validation error on domains with MX or SRV records. The Domeneshop API returns `priority`, `weight` and `port` as strings, although its OpenAPI spec documents integers; they are now converted to numbers.
