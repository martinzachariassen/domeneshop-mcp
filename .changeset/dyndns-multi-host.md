---
"domeneshop-mcp": patch
---

`update_dyndns` now tells the model it can update several comma-separated hostnames in one call, as the Domeneshop API allows. The `Invoice` type marks `due_date` and `paid_date` as nullable, matching what the API returns for unpaid invoices.
