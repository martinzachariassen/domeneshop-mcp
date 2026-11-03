---
"domeneshop-mcp": patch
---

Fix the HTTP forward tools against the live Domeneshop API:

- `update_forward` reported an error after every successful update, because the API answers `204` with no body; it now returns the stored forward.
- `get_forward`, and `update_forward` without `frame`, failed for hosts containing a hyphen (e.g. `my-app`), which the API cannot look up by host; they now find the forward through the list.
- `update_forward` and `delete_forward` cannot work around that limitation for such hosts, so they now say so and point to the Domeneshop control panel instead of reporting a bare "not found".
