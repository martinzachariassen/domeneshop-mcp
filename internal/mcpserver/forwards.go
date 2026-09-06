package mcpserver

import (
	"context"

	"github.com/martinzachariassen/domeneshop-mcp/internal/domeneshop"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerForwardTools(s *mcp.Server, client *domeneshop.Client) {
	type listForwardsArgs struct {
		DomainID int `json:"domain_id" jsonschema:"the Domeneshop domain ID, from list_domains"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_forwards",
		Description: "List all HTTP forwards configured for a domain.",
		Annotations: readOnly(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args listForwardsArgs) (*mcp.CallToolResult, any, error) {
		forwards, err := client.ListForwards(ctx, args.DomainID)
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(forwards)
	})

	type getForwardArgs struct {
		DomainID int    `json:"domain_id" jsonschema:"the Domeneshop domain ID, from list_domains"`
		Host     string `json:"host" jsonschema:"the host/subdomain the forward applies to, e.g. 'www' or '@' for the root"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_forward",
		Description: "Get the HTTP forward configured for a specific host.",
		Annotations: readOnly(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args getForwardArgs) (*mcp.CallToolResult, any, error) {
		forward, err := client.GetForward(ctx, args.DomainID, args.Host)
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(forward)
	})

	type forwardArgs struct {
		DomainID int    `json:"domain_id" jsonschema:"the Domeneshop domain ID, from list_domains"`
		Host     string `json:"host" jsonschema:"the host/subdomain to forward, e.g. 'www' or '@' for the root"`
		URL      string `json:"url" jsonschema:"the destination URL to forward requests to"`
		Frame    bool   `json:"frame,omitempty" jsonschema:"if true, show the destination in a frame instead of redirecting"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_forward",
		Description: "Create a new HTTP forward for a domain. Fails if the host already has a forward or a conflicting A, AAAA, ANAME or CNAME record.",
		Annotations: additive(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args forwardArgs) (*mcp.CallToolResult, any, error) {
		created, err := client.CreateForward(ctx, args.DomainID, domeneshop.Forward{Host: args.Host, URL: args.URL, Frame: args.Frame})
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(created)
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "update_forward",
		Description: "Update an existing HTTP forward for a domain.",
		Annotations: destructive(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args forwardArgs) (*mcp.CallToolResult, any, error) {
		updated, err := client.UpdateForward(ctx, args.DomainID, args.Host, domeneshop.Forward{Host: args.Host, URL: args.URL, Frame: args.Frame})
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(updated)
	})

	type deleteForwardArgs struct {
		DomainID int    `json:"domain_id" jsonschema:"the Domeneshop domain ID, from list_domains"`
		Host     string `json:"host" jsonschema:"the host/subdomain whose forward should be deleted"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "delete_forward",
		Description: "Delete an HTTP forward.",
		Annotations: destructive(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args deleteForwardArgs) (*mcp.CallToolResult, any, error) {
		if err := client.DeleteForward(ctx, args.DomainID, args.Host); err != nil {
			return nil, nil, err
		}
		return textResult("Forward deleted.")
	})
}
