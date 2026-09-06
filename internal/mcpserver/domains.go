package mcpserver

import (
	"context"

	"github.com/martinzachariassen/domeneshop-mcp/internal/domeneshop"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerDomainTools(s *mcp.Server, client *domeneshop.Client) {
	type listDomainsArgs struct {
		Filter string `json:"filter,omitempty" jsonschema:"only return domains matching this name"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_domains",
		Description: "List all domains on the Domeneshop account, optionally filtered by domain name.",
		Annotations: readOnly(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args listDomainsArgs) (*mcp.CallToolResult, any, error) {
		domains, err := client.ListDomains(ctx, args.Filter)
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(domains)
	})

	type getDomainArgs struct {
		DomainID int `json:"domain_id" jsonschema:"the Domeneshop domain ID, from list_domains"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_domain",
		Description: "Get details for a single domain by its Domeneshop domain ID.",
		Annotations: readOnly(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args getDomainArgs) (*mcp.CallToolResult, any, error) {
		domain, err := client.GetDomain(ctx, args.DomainID)
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(domain)
	})
}
