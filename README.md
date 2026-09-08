# domeneshop-mcp

[![CI](https://github.com/martinzachariassen/domeneshop-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/martinzachariassen/domeneshop-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/domeneshop-mcp)](https://www.npmjs.com/package/domeneshop-mcp)

An [MCP](https://modelcontextprotocol.io) server that exposes the
[Domeneshop API](https://api.domeneshop.no/docs/) as tools, so an AI assistant can
manage your domains, DNS records, HTTP forwards and invoices.

Every operation the Domeneshop API offers is available as a tool — 15 of them,
covering domains, DNS, HTTP forwarding, dynamic DNS and invoices.

This is a standard MCP server communicating over stdio, so it works with
**any MCP-compatible client**. That includes Claude Code,
Claude Desktop, Cursor, VS Code (with GitHub Copilot), Codex, Windsurf, Cline,
and anything else that speaks MCP. See [Configuration](#configuration) for
setup in each of those, and [Tools](#tools) for everything the server can do.

## Quick start

1. Get an API token and secret from
   [domeneshop.no/admin?view=api](https://www.domeneshop.no/admin?view=api).
2. Register the server with your MCP client. For Claude Code:

   ```sh
   claude mcp add domeneshop \
     --env DOMENESHOP_API_TOKEN=your-token \
     --env DOMENESHOP_API_SECRET=your-secret \
     -- npx -y domeneshop-mcp
   ```

That's it — ask your assistant to list your domains and it will pick up the
new tools. This registers the server for the current project only; add
`--scope user` to make it available everywhere. If you're using a different
client, jump to [Configuration](#configuration) for the equivalent setup.

## Contents

- [Quick start](#quick-start)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Tools](#tools)
- [Notes on the Domeneshop API](#notes-on-the-domeneshop-api)
- [Development](#development)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Requirements

- A Domeneshop account with API credentials, created at
  [domeneshop.no/admin?view=api](https://www.domeneshop.no/admin?view=api).
- Node.js 20 or newer.

## Installation

```sh
npm install -g domeneshop-mcp
```

Or run it directly without installing, via `npx`:

```sh
npx domeneshop-mcp
```

## Configuration

The server reads its credentials from two environment variables and refuses to
start without them:

| Variable | Description |
| --- | --- |
| `DOMENESHOP_API_TOKEN` | API token from the Domeneshop control panel |
| `DOMENESHOP_API_SECRET` | The matching API secret |

It speaks MCP over stdio, so it is launched by your MCP client rather than run
directly — `npx -y domeneshop-mcp` is the command every client below runs to
start it. Swap in your real token and secret wherever you see the placeholders.

Most clients also let you scope a server to just the current project (private,
or shared with your team via a file checked into version control) or make it
available everywhere on your machine — usually by picking which config file
you write to. Each client below notes this where it applies; Claude Desktop
and Codex only have a single, machine-wide config file.

<details>
<summary><strong>Claude Code</strong></summary>

```sh
claude mcp add domeneshop \
  --env DOMENESHOP_API_TOKEN=your-token \
  --env DOMENESHOP_API_SECRET=your-secret \
  -- npx -y domeneshop-mcp
```

This defaults to `--scope local` (private to you, only in this project). Use
`--scope project` to write it to `<your-project>/.mcp.json` instead (shared via
version control — see the block below), or `--scope user` for every project on
your account.

If you'd rather not resolve the package via `npx` on every launch, install it
once and point Claude Code at the binary directly:

```sh
npm install -g domeneshop-mcp
claude mcp add domeneshop \
  --env DOMENESHOP_API_TOKEN=your-token \
  --env DOMENESHOP_API_SECRET=your-secret \
  -- domeneshop-mcp
```

You can also add it from raw JSON:

```sh
claude mcp add-json domeneshop '{"command":"npx","args":["-y","domeneshop-mcp"],"env":{"DOMENESHOP_API_TOKEN":"your-token","DOMENESHOP_API_SECRET":"your-secret"}}'
```

Or, for `--scope project`, edit `<your-project>/.mcp.json` directly:

```json
{
  "mcpServers": {
    "domeneshop": {
      "command": "npx",
      "args": ["-y", "domeneshop-mcp"],
      "env": {
        "DOMENESHOP_API_TOKEN": "your-token",
        "DOMENESHOP_API_SECRET": "your-secret"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config), found at:

| Platform | Full path |
| --- | --- |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux (unofficial builds) | `~/.config/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "domeneshop": {
      "command": "npx",
      "args": ["-y", "domeneshop-mcp"],
      "env": {
        "DOMENESHOP_API_TOKEN": "your-token",
        "DOMENESHOP_API_SECRET": "your-secret"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add the same `mcpServers` block to a `mcp.json` file, found at:

| Scope | Full path |
| --- | --- |
| This project only | `<your-project>/.cursor/mcp.json` |
| Every project (macOS/Linux) | `~/.cursor/mcp.json` |
| Every project (Windows) | `%USERPROFILE%\.cursor\mcp.json` |

```json
{
  "mcpServers": {
    "domeneshop": {
      "command": "npx",
      "args": ["-y", "domeneshop-mcp"],
      "env": {
        "DOMENESHOP_API_TOKEN": "your-token",
        "DOMENESHOP_API_SECRET": "your-secret"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code (GitHub Copilot)</strong></summary>

VS Code uses a `servers` key instead of `mcpServers`. For this project only,
add it to `<your-project>/.vscode/mcp.json`:

```json
{
  "servers": {
    "domeneshop": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "domeneshop-mcp"],
      "env": {
        "DOMENESHOP_API_TOKEN": "your-token",
        "DOMENESHOP_API_SECRET": "your-secret"
      }
    }
  }
}
```

For every project, run the command palette action **MCP: Open User
Configuration** and add the same block there — or register it in one line
from a terminal:

```sh
code --add-mcp '{"name":"domeneshop","command":"npx","args":["-y","domeneshop-mcp"],"env":{"DOMENESHOP_API_TOKEN":"your-token","DOMENESHOP_API_SECRET":"your-secret"}}'
```

</details>

<details>
<summary><strong>Codex</strong></summary>

Codex CLI reads MCP servers from `mcp_servers` in its config file, found at:

| Platform | Full path |
| --- | --- |
| macOS/Linux | `~/.codex/config.toml` |
| Windows | `%USERPROFILE%\.codex\config.toml` |

```toml
[mcp_servers.domeneshop]
command = "npx"
args = ["-y", "domeneshop-mcp"]
env = { DOMENESHOP_API_TOKEN = "your-token", DOMENESHOP_API_SECRET = "your-secret" }
```

Or register it from the command line:

```sh
codex mcp add domeneshop -- npx -y domeneshop-mcp
```

Then set the two env vars in the `[mcp_servers.domeneshop]` block it creates,
since `codex mcp add` doesn't take them as flags.

</details>

<details>
<summary><strong>Any other MCP client</strong></summary>

Any client that supports MCP servers over stdio can run this server — Windsurf,
Cline, Continue, LM Studio, or a client you've built yourself with the MCP SDK.
Most follow the same `mcpServers`-with-`command`/`args`/`env` shape used above
for Claude Desktop and Cursor; check your client's documentation for the exact
config file and key name, then point it at:

- **command**: `npx`
- **args**: `["-y", "domeneshop-mcp"]`
- **env**: `DOMENESHOP_API_TOKEN` and `DOMENESHOP_API_SECRET`

If your client can't run `npx` directly, install the package globally with
`npm install -g domeneshop-mcp` and use `domeneshop-mcp` as the command with no
args instead.

</details>

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
- `GET /dyndns/update` answers with a plain-text status line, not JSON.

The `tag` field is deliberately untyped: it is a numeric key tag for `DS` and a
property tag such as `issue` for `CAA`, and Domeneshop documents neither.

## Development

```sh
npm install          # install dependencies
npm run dev          # run the server from source with tsx
npm run build        # compile to ./dist
npm run typecheck    # type-check without emitting
npm run lint         # lint with Biome
npm run format       # format with Biome
npm test             # run the test suite (vitest)
```

The tests stub the Domeneshop API with a local `node:http` server and drive the
MCP server over an in-memory transport, so they need no credentials and make no
network calls.

### Project layout

```
src/
  domeneshop/       Domeneshop API client (HTTP transport + one resource per endpoint group)
  mcp/              MCP server: tool registration, schemas, result/error helpers
  index.ts          CLI entry point
test/
  domeneshop/       Client tests, against a local HTTP server
  mcp/              End-to-end tool tests, against an in-memory MCP transport
```

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md)
for the development workflow and changelog conventions.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

[MIT](LICENSE)
