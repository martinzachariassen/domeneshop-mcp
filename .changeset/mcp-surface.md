---
"domeneshop-mcp": minor
---

Polish the MCP surface:

- Every tool now has a human-readable title and the `openWorldHint` annotation, and the server sends usage instructions on initialize.
- Inputs are validated before anything reaches Domeneshop: TTL range and multiple of 60, `http(s)` forward URLs, IP addresses for dynamic DNS (now including comma-separated IPv4/IPv6 lists), enums for the `list_dns_records` type and `list_invoices` status filters, and the fields each record type requires (e.g. `priority` for MX).
- Read-only tools declare an `outputSchema` and return `structuredContent`; lists are wrapped as `{ domains }`, `{ records }`, `{ forwards }` and `{ invoices }` there, while the text content stays the plain array.
- `create_dns_record` and `update_dns_record` return the record as stored instead of just an ID or a confirmation, and delete/dyndns messages say what was changed.
- Cancelling a tool call from the client now aborts the underlying API request.
