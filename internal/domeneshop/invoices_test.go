package domeneshop

import (
	"context"
	"net/http"
	"testing"
)

func TestListInvoicesStatusFilter(t *testing.T) {
	var gotQuery string
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.RawQuery
		w.Write([]byte("[]"))
	})

	if _, err := c.ListInvoices(context.Background(), "unpaid"); err != nil {
		t.Fatal(err)
	}
	if gotQuery != "status=unpaid" {
		t.Errorf("query = %q, want status=unpaid", gotQuery)
	}

	if _, err := c.ListInvoices(context.Background(), ""); err != nil {
		t.Fatal(err)
	}
	if gotQuery != "" {
		t.Errorf("query = %q, want empty when no status is given", gotQuery)
	}
}

func TestGetInvoiceDecodesFields(t *testing.T) {
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/invoices/1" {
			t.Errorf("path = %q, want /invoices/1", r.URL.Path)
		}
		w.Write([]byte(`{"id":1,"type":"invoice","amount":120,"currency":"NOK",
		  "due_date":"2026-01-31","issued_date":"2026-01-01","paid_date":"2026-01-15",
		  "status":"paid","url":"https://www.domeneshop.no/invoice?nr=1&code=x"}`))
	})

	invoice, err := c.GetInvoice(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}

	if invoice.ID != 1 || invoice.Amount != 120 || invoice.Currency != "NOK" || invoice.Status != "paid" {
		t.Errorf("invoice = %+v", *invoice)
	}
}
