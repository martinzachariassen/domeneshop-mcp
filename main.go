// Command domeneshop-mcp is an MCP server exposing the Domeneshop API
// (domains, DNS, HTTP forwarding, dynamic DNS and invoices) as MCP tools.
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/martinzachariassen/domeneshop-mcp/internal/domeneshop"
	"github.com/martinzachariassen/domeneshop-mcp/internal/mcpserver"
	"github.com/martinzachariassen/domeneshop-mcp/internal/version"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	if len(os.Args) > 1 && (os.Args[1] == "-version" || os.Args[1] == "--version") {
		fmt.Println("domeneshop-mcp", version.String())
		return
	}

	token := os.Getenv("DOMENESHOP_API_TOKEN")
	secret := os.Getenv("DOMENESHOP_API_SECRET")
	if token == "" || secret == "" {
		log.Fatal("DOMENESHOP_API_TOKEN and DOMENESHOP_API_SECRET must be set (create credentials at https://www.domeneshop.no/admin?view=api)")
	}

	client := domeneshop.NewClient(token, secret)
	server := mcpserver.New(client)

	if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		fmt.Fprintln(os.Stderr, "domeneshop-mcp:", err)
		os.Exit(1)
	}
}
