package mcpserver

import (
	"context"

	"github.com/martinzachariassen/domeneshop-mcp/internal/domeneshop"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerInvoiceTools(s *mcp.Server, client *domeneshop.Client) {
	type listInvoicesArgs struct {
		Status string `json:"status,omitempty" jsonschema:"only return invoices with this status: unpaid, paid or settled"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_invoices",
		Description: "List invoices from the past three years on the Domeneshop account, optionally filtered by status.",
		Annotations: readOnly(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args listInvoicesArgs) (*mcp.CallToolResult, any, error) {
		invoices, err := client.ListInvoices(ctx, args.Status)
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(invoices)
	})

	type getInvoiceArgs struct {
		InvoiceID int `json:"invoice_id" jsonschema:"the invoice ID, from list_invoices"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_invoice",
		Description: "Get details for a single invoice.",
		Annotations: readOnly(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args getInvoiceArgs) (*mcp.CallToolResult, any, error) {
		invoice, err := client.GetInvoice(ctx, args.InvoiceID)
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(invoice)
	})
}
