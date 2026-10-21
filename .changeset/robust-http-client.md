---
"domeneshop-mcp": minor
---

Make the API client more robust: requests now time out after 30 seconds, `GET`/`PUT`/`DELETE` are retried on 429/502/503/504 and network errors (honouring `Retry-After`, never retrying `POST`), a `User-Agent` header identifies the server, and error messages explain common statuses (401/403/404/409/429/5xx) with HTML bodies stripped and long bodies truncated. Network failures and timeouts surface as `DomeneshopNetworkError`. Node 20.3 or newer is now required.
