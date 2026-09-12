<h1 align="center">domeneshop-mcp</h1>

<p align="center">
  Manage your Domeneshop domains, DNS records, HTTP forwards and invoices from any AI assistant.
</p>

<p align="center">
  <a href="https://github.com/martinzachariassen/domeneshop-mcp/actions/workflows/ci.yml"><img src="https://github.com/martinzachariassen/domeneshop-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/domeneshop-mcp"><img src="https://img.shields.io/npm/v/domeneshop-mcp" alt="npm version"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/domeneshop-mcp"><b>npm package</b></a>
  &nbsp;·&nbsp;
  <a href="https://api.domeneshop.no/docs/"><b>Domeneshop API</b></a>
  &nbsp;·&nbsp;
  <a href="https://www.domeneshop.no/admin?view=api"><b>Get API credentials</b></a>
</p>

An [MCP](https://modelcontextprotocol.io) server that turns the
[Domeneshop API](https://api.domeneshop.no/docs/) into tools an assistant can call.
Every operation the API offers is covered — 15 tools across domains, DNS, HTTP
forwarding, dynamic DNS and invoices.

It talks MCP over stdio, so it works with **any MCP-compatible client**: Claude
Code, Claude Desktop, Cursor, VS Code, Codex, Windsurf, Cline and others.

## Quick start

You need Node.js 20 or newer and a Domeneshop account.

**1. Create an API token and secret** at
[domeneshop.no/admin?view=api](https://www.domeneshop.no/admin?view=api).

**2. Register the server.** In Claude Code:

```sh
claude mcp add domeneshop \
  --env DOMENESHOP_API_TOKEN=your-token \
  --env DOMENESHOP_API_SECRET=your-secret \
  -- npx -y domeneshop-mcp
```

**3. Ask for something.** "List my domains" is enough to confirm the tools loaded.

Using a different client? See [Client setup](#client-setup) below.

## Client setup

The server is launched by your client rather than run by hand, and reads its
credentials from two environment variables:

| Variable | Description |
| --- | --- |
| `DOMENESHOP_API_TOKEN` | API token from the Domeneshop control panel |
| `DOMENESHOP_API_SECRET` | The matching API secret |

Most clients take the same **standard config**. Swap in your real token and
secret wherever you see the placeholders.

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

Most clients can also scope a server to the current project or make it
available everywhere, usually by choosing which config file you write to. The
blocks below note this where it applies.

<details>
<summary><strong>Claude Code</strong></summary>

Use the CLI command from [Quick start](#quick-start). It defaults to
`--scope local`, private to you and this project. Use `--scope project` to
write `<your-project>/.mcp.json` instead, shared via version control, or
`--scope user` for every project on your account.

You can also pass the standard config as raw JSON:

```sh
claude mcp add-json domeneshop '{"command":"npx","args":["-y","domeneshop-mcp"],"env":{"DOMENESHOP_API_TOKEN":"your-token","DOMENESHOP_API_SECRET":"your-secret"}}'
```

Or write the standard config straight into `<your-project>/.mcp.json`.

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add the standard config to `claude_desktop_config.json`, reachable from
Settings → Developer → Edit Config:

| Platform | Full path |
| --- | --- |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux (unofficial builds) | `~/.config/Claude/claude_desktop_config.json` |

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add the standard config to an `mcp.json` file:

| Scope | Full path |
| --- | --- |
| This project only | `<your-project>/.cursor/mcp.json` |
| Every project (macOS/Linux) | `~/.cursor/mcp.json` |
| Every project (Windows) | `%USERPROFILE%\.cursor\mcp.json` |

</details>

<details>
<summary><strong>VS Code (GitHub Copilot)</strong></summary>

VS Code uses a `servers` key instead of `mcpServers`, and wants an explicit
`type`. For this project only, add it to `<your-project>/.vscode/mcp.json`:

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
Configuration** and add the same block there, or register it in one line:

```sh
code --add-mcp '{"name":"domeneshop","command":"npx","args":["-y","domeneshop-mcp"],"env":{"DOMENESHOP_API_TOKEN":"your-token","DOMENESHOP_API_SECRET":"your-secret"}}'
```

</details>

<details>
<summary><strong>Codex</strong></summary>

Codex CLI reads MCP servers from `mcp_servers` in its config file:

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

`codex mcp add domeneshop -- npx -y domeneshop-mcp` registers it from the
command line, but takes no env flags, so set the two variables in the
`[mcp_servers.domeneshop]` block it creates.

</details>

<details>
<summary><strong>Any other MCP client</strong></summary>

Windsurf, Cline, Continue, LM Studio and anything else that runs MCP servers
over stdio will work. Most use the same shape as the standard config above;
check your client's documentation for the config file and key name, then point
it at:

- **command**: `npx`
- **args**: `["-y", "domeneshop-mcp"]`
- **env**: `DOMENESHOP_API_TOKEN` and `DOMENESHOP_API_SECRET`

</details>

<details>
<summary><strong>Skipping npx</strong></summary>

To avoid resolving the package on every launch, install it once and use
`domeneshop-mcp` as the command with no args:

```sh
npm install -g domeneshop-mcp
```

</details>

## What you can ask for

| Area | Example prompt |
| --- | --- |
| Domains | "Which domains are on my account, and when do they renew?" |
| DNS | "Show every DNS record for example.no" |
| DNS | "Point blog.example.no at 203.0.113.10" |
| DNS | "Add the TXT record Google gave me for domain verification" |
| DNS | "Set up Fastmail's MX records on example.no" |
| Forwarding | "Forward old.example.no to https://example.no" |
| Dynamic DNS | "Update home.example.no to my current IP" |
| Invoices | "List my unpaid Domeneshop invoices" |

## Tools

Every tool declares MCP annotations, so clients know which ones are safe to run
without asking you first. The Access column below mirrors those annotations.

### Domains

| Tool | Access | Description |
| --- | --- | --- |
| `list_domains` | Read-only | List all domains on the account, optionally filtered by name |
| `get_domain` | Read-only | Get a single domain by its Domeneshop domain ID |

### DNS

| Tool | Access | Description |
| --- | --- | --- |
| `list_dns_records` | Read-only | List a domain's records, optionally filtered by host and type |
| `get_dns_record` | Read-only | Get a single record by ID |
| `create_dns_record` | Adds | Create a record |
| `update_dns_record` | Overwrites | Replace a record — see the warning below |
| `delete_dns_record` | Deletes | Delete a record |

> **Heads up:** `update_dns_record` replaces the whole record rather than
> patching it. Any field left out is dropped, and omitting `ttl` resets it to
> the default 3600 seconds. Read the record first if you are only changing part
> of it.

### HTTP forwarding

| Tool | Access | Description |
| --- | --- | --- |
| `list_forwards` | Read-only | List a domain's HTTP forwards |
| `get_forward` | Read-only | Get the forward for one host |
| `create_forward` | Adds | Create a forward |
| `update_forward` | Overwrites | Update a forward |
| `delete_forward` | Deletes | Delete a forward |

### Dynamic DNS

| Tool | Access | Description |
| --- | --- | --- |
| `update_dyndns` | Overwrites | Point a hostname at a given IP, or at the caller's apparent IP |

### Invoices

| Tool | Access | Description |
| --- | --- | --- |
| `list_invoices` | Read-only | List invoices from the past three years, optionally filtered by status |
| `get_invoice` | Read-only | Get a single invoice |

## Reference

<details>
<summary><strong>Supported DNS record types</strong></summary>

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

The `tag` field is deliberately untyped: it is a numeric key tag for `DS` and a
property tag such as `issue` for `CAA`, and Domeneshop documents neither.

</details>

<details>
<summary><strong>Undocumented Domeneshop API behaviour</strong></summary>

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

</details>

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

<details>
<summary><strong>Project layout</strong></summary>

```
src/
  domeneshop/       Domeneshop API client (HTTP transport + one resource per endpoint group)
  mcp/              MCP server: tool registration, schemas, result/error helpers
  index.ts          CLI entry point
test/
  domeneshop/       Client tests, against a local HTTP server
  mcp/              End-to-end tool tests, against an in-memory MCP transport
```

</details>

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md)
for the development workflow and changelog conventions.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

[MIT](LICENSE)
