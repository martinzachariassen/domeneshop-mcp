---
"domeneshop-mcp": major
---

**Breaking:** `update_forward` keeps the forward's stored `frame` setting when `frame` is omitted, instead of resetting it to `false`. Pass `frame: false` to turn framing off.
