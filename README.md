# domeneshop-mcp

An [MCP](https://modelcontextprotocol.io) server that exposes the
[Domeneshop API](https://api.domeneshop.no/docs/) as tools, so an AI assistant can
manage your domains, DNS records, HTTP forwards and invoices.

Every operation the Domeneshop API offers is available as a tool — 15 of them,
covering domains, DNS, HTTP forwarding, dynamic DNS and invoices.

[![ci](https://github.com/martinzachariassen/domeneshop-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/martinzachariassen/domeneshop-mcp/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Requirements

- A Domeneshop account with API credentials, created at
  [domeneshop.no/admin?view=api](https://www.domeneshop.no/admin?view=api).
- Go 1.27 or newer, if you install from source.

## Installation

```sh
go install github.com/martinzachariassen/domeneshop-mcp@latest
```

Or download a prebuilt binary for macOS or Linux from the
[releases page](https://github.com/martinzachariassen/domeneshop-mcp/releases).

Release archives are checksummed, and the checksums file is keyless-signed with
[cosign](https://github.com/sigstore/cosign) from the GitHub Actions run that
built it. To verify a download:

```sh
cosign verify-blob checksums.txt \
  --certificate checksums.txt.pem \
  --signature checksums.txt.sig \
  --certificate-identity-regexp 'https://github.com/martinzachariassen/domeneshop-mcp/.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

## Configuration

The server reads its credentials from two environment variables and refuses to
start without them:

| Variable | Description |
| --- | --- |
| `DOMENESHOP_API_TOKEN` | API token from the Domeneshop control panel |
| `DOMENESHOP_API_SECRET` | The matching API secret |

It speaks MCP over stdio, so it is launched by your MCP client rather than run
directly.

### Claude Code

```sh
claude mcp add domeneshop \
  --env DOMENESHOP_API_TOKEN=your-token \
  --env DOMENESHOP_API_SECRET=your-secret \
  -- domeneshop-mcp
```

### Claude Desktop and other clients

Add the server to your client's MCP configuration — for Claude Desktop that is
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "domeneshop": {
      "command": "domeneshop-mcp",
      "env": {
        "DOMENESHOP_API_TOKEN": "your-token",
        "DOMENESHOP_API_SECRET": "your-secret"
      }
    }
  }
}
```

Use the absolute path to the binary (`which domeneshop-mcp`) if your client does
not inherit your shell's `PATH`.

## Tools

Read-only tools are annotated as such, and the tools that overwrite or delete
state are marked destructive, so clients can decide what to run without asking
you first.

### Domains

| Tool | Description |
| --- | --- |
| `list_domains` | List all domains on the account, optionally filtered by name |
| `get_domain` | Get a single domain by its Domeneshop domain ID |

### DNS

| Tool | Description |
| --- | --- |
| `list_dns_records` | List a domain's records, optionally filtered by host and type |
| `get_dns_record` | Get a single record by ID |
| `create_dns_record` | Create a record |
| `update_dns_record` | Replace a record (destructive — see the note below) |
| `delete_dns_record` | Delete a record |

All eleven record types Domeneshop accepts are supported, with their
type-specific fields:

| Type | Fields beyond `host`, `data` and `ttl` |
| --- | --- |
| `A`, `AAAA`, `ANAME`, `CNAME`, `NS`, `TXT` | — |
| `MX` | `priority` |
| `SRV` | `priority`, `weight`, `port` |
| `TLSA` | `usage`, `selector`, `dtype` |
| `DS` | `tag`, `alg`, `digest` |
| `CAA` | `flags`, `tag` |

`update_dns_record` replaces the whole record rather than patching it: any field
left out is dropped, and omitting `ttl` resets it to the default 3600 seconds.
Read the record first if you are only changing part of it.

### HTTP forwarding

| Tool | Description |
| --- | --- |
| `list_forwards` | List a domain's HTTP forwards |
| `get_forward` | Get the forward for one host |
| `create_forward` | Create a forward |
| `update_forward` | Update a forward |
| `delete_forward` | Delete a forward |

### Dynamic DNS

| Tool | Description |
| --- | --- |
| `update_dyndns` | Point a hostname at a given IP, or at the caller's apparent IP |

### Invoices

| Tool | Description |
| --- | --- |
| `list_invoices` | List invoices from the past three years, optionally filtered by status |
| `get_invoice` | Get a single invoice |

## Notes on the Domeneshop API

A few things this server relies on are not in Domeneshop's published OpenAPI
spec, but are supported and used by their own client libraries:

- The spec documents seven record types; `ANAME`, `CAA`, `DS` and `NS` work too,
  as the record validation in
  [domeneshop.js](https://github.com/domeneshop/domeneshop.js) and
  [python-domeneshop](https://github.com/domeneshop/python-domeneshop) shows.
- `GET /invoices` accepts a `status` filter, which domeneshop.js uses.
- `POST /forwards/` answers `201` with an empty body and names the new forward
  only in the `Location` header.

The `tag` field is deliberately untyped: it is a numeric key tag for `DS` and a
property tag such as `issue` for `CAA`, and Domeneshop documents neither.

## Development

```sh
make build           # build ./bin/domeneshop-mcp
make install         # build and install into $GOBIN
make dist            # cross-compile release binaries into ./dist
go test ./...        # run the tests
```

The tests stub the Domeneshop API with `httptest` and drive the MCP server over
an in-memory transport, so they need no credentials and make no network calls.

## Contributing

Issues and pull requests are welcome. Please keep `go vet ./...` and
`go test ./...` clean, and run `gofmt` on anything you touch — CI checks all
three.

## License

[MIT](LICENSE)
