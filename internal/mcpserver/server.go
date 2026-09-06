// Package mcpserver exposes the Domeneshop API as MCP tools.
package mcpserver

import (
	"github.com/martinzachariassen/domeneshop-mcp/internal/domeneshop"
	"github.com/martinzachariassen/domeneshop-mcp/internal/version"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// New creates an MCP server with all Domeneshop tools registered.
func New(client *domeneshop.Client) *mcp.Server {
	s := mcp.NewServer(&mcp.Implementation{
		Name:    "domeneshop-mcp",
		Version: version.String(),
	}, nil)

	registerDomainTools(s, client)
	registerDNSTools(s, client)
	registerForwardTools(s, client)
	registerDynDNSTools(s, client)
	registerInvoiceTools(s, client)

	return s
}
