---
"domeneshop-mcp": patch
---

Stricter tool input validation, so mistakes are reported before anything reaches the Domeneshop API:

- An empty or blank `host` is rejected. Before, `get_forward` and `delete_forward` with `host: ""` hit the list endpoint instead.
- DNS `data` must not be empty, and A/AAAA records must carry an IPv4/IPv6 address respectively (also checked for the merged record in `patch_dns_record` and `upsert_dns_record`).
- Type-specific DNS fields have ranges: `priority`, `weight`, `port` and the DS key tag 0-65535; `usage` 0-3, `selector` 0-1, `dtype` 0-2; `alg`, `digest` and `flags` 0-255. DS needs a numeric `tag`, CAA a string `tag`.
- `update_dyndns` rejects hostnames containing whitespace.
