# Undocumented Domeneshop API behaviour

A few things this server relies on are not in Domeneshop's published OpenAPI
spec, but are supported and used by their own client libraries:

- The spec documents seven record types; `ANAME`, `CAA`, `DS` and `NS` work too,
  as the record validation in
  [domeneshop.js](https://github.com/domeneshop/domeneshop.js) and
  [python-domeneshop](https://github.com/domeneshop/python-domeneshop) shows.
- `GET /invoices` accepts a `status` filter, which domeneshop.js uses.
- `POST /forwards/` answers `201` with an empty body and names the new forward
  only in the `Location` header.
- `GET /dyndns/update` answers `204` with no body rather than JSON, so the
  client does not try to decode it.
- `PUT /forwards/{host}` answers `204` with no body, not `200` with the forward.
- `GET`, `PUT` and `DELETE /forwards/{host}` answer `404` when the host contains
  a hyphen (e.g. `my-app`), although such forwards can be created and are
  listed. `get_forward` falls back to the list; `update_forward` and
  `delete_forward` cannot, and say so: change or delete those forwards in the
  Domeneshop control panel.
- MX and SRV records return `priority`, `weight` and `port` as strings; the
  client converts them to numbers.
- Credit notes have `type: "credit_note"`; the spec spells it `credit_node`.

The client is tested against a stored copy of the published spec, with the
behaviour above added as an explicit overlay (see `test/contract/`). A weekly
workflow flags any change to the published spec.
