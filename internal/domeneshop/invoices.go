package domeneshop

import (
	"context"
	"fmt"
	"net/url"
)

type Invoice struct {
	ID         int     `json:"id"`
	Type       string  `json:"type"`
	Amount     float64 `json:"amount"`
	Currency   string  `json:"currency"`
	DueDate    string  `json:"due_date"`
	IssuedDate string  `json:"issued_date"`
	PaidDate   string  `json:"paid_date"`
	Status     string  `json:"status"`
	URL        string  `json:"url"`
}

// InvoiceStatuses lists the accepted values for the ListInvoices status filter.
// "settled" applies only to credit notes.
var InvoiceStatuses = []string{"unpaid", "paid", "settled"}

// ListInvoices lists invoices from the past three years, optionally filtered by
// status.
//
// The status query parameter is missing from the published OpenAPI spec but is
// supported; Domeneshop's own JavaScript client relies on it. See
// https://github.com/domeneshop/domeneshop.js (src/lib/invoices.ts).
func (c *Client) ListInvoices(ctx context.Context, status string) ([]Invoice, error) {
	query := url.Values{}
	if status != "" {
		query.Set("status", status)
	}
	var invoices []Invoice
	if _, err := c.request(ctx, "GET", "/invoices", query, nil, &invoices); err != nil {
		return nil, err
	}
	return invoices, nil
}

// GetInvoice retrieves a single invoice.
func (c *Client) GetInvoice(ctx context.Context, invoiceID int) (*Invoice, error) {
	var invoice Invoice
	if _, err := c.request(ctx, "GET", fmt.Sprintf("/invoices/%d", invoiceID), nil, nil, &invoice); err != nil {
		return nil, err
	}
	return &invoice, nil
}
