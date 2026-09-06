package mcpserver

import (
	"context"

	"github.com/martinzachariassen/domeneshop-mcp/internal/domeneshop"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerDynDNSTools(s *mcp.Server, client *domeneshop.Client) {
	type updateDynDNSArgs struct {
		Hostname string `json:"hostname" jsonschema:"the hostname to update, must have an existing A or AAAA record"`
		MyIP     string `json:"myip,omitempty" jsonschema:"the IP address to set; if omitted, Domeneshop uses the caller's apparent IP"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "update_dyndns",
		Description: "Update a hostname's DNS record to point at the given (or caller's apparent) IP address, using Domeneshop's dynamic DNS protocol.",
		Annotations: destructive(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args updateDynDNSArgs) (*mcp.CallToolResult, any, error) {
		if err := client.UpdateDynDNS(ctx, args.Hostname, args.MyIP); err != nil {
			return nil, nil, err
		}
		return textResult("Dynamic DNS record updated.")
	})
}
