package domeneshop

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"reflect"
	"testing"
)

// operation describes one Domeneshop API operation: the client method that
// performs it, and the exact HTTP request it is expected to produce.
//
// Every operation the API offers has an entry here, and
// TestEveryClientMethodIsExercised fails if a method is added without one, so
// this table is the record of what is covered.
type operation struct {
	// method is the Client method's name, used to prove the table is complete.
	method string
	call   func(context.Context, *Client) error

	wantMethod string
	wantPath   string
	wantQuery  string
	wantBody   string // empty means no request body is expected

	status   int
	response string
}

func operations() []operation {
	ttl, priority := 3600, 10

	return []operation{
		{
			method:     "ListDomains",
			call:       func(ctx context.Context, c *Client) error { _, err := c.ListDomains(ctx, "example.com"); return err },
			wantMethod: "GET", wantPath: "/domains", wantQuery: "domain=example.com",
			status: 200, response: `[{"id":1,"domain":"example.com"}]`,
		},
		{
			method:     "GetDomain",
			call:       func(ctx context.Context, c *Client) error { _, err := c.GetDomain(ctx, 42); return err },
			wantMethod: "GET", wantPath: "/domains/42",
			status: 200, response: `{"id":42,"domain":"example.com"}`,
		},
		{
			method: "ListDNSRecords",
			call: func(ctx context.Context, c *Client) error {
				_, err := c.ListDNSRecords(ctx, 42, "www", "A")
				return err
			},
			wantMethod: "GET", wantPath: "/domains/42/dns", wantQuery: "host=www&type=A",
			status: 200, response: `[]`,
		},
		{
			method:     "GetDNSRecord",
			call:       func(ctx context.Context, c *Client) error { _, err := c.GetDNSRecord(ctx, 42, 7); return err },
			wantMethod: "GET", wantPath: "/domains/42/dns/7",
			status: 200, response: `{"id":7,"host":"www","type":"A","data":"192.0.2.1"}`,
		},
		{
			method: "CreateDNSRecord",
			call: func(ctx context.Context, c *Client) error {
				_, err := c.CreateDNSRecord(ctx, 42, DNSRecord{Host: "@", Type: "MX", Data: "mx.example.com", TTL: &ttl, Priority: &priority})
				return err
			},
			wantMethod: "POST", wantPath: "/domains/42/dns",
			wantBody: `{"host":"@","ttl":3600,"type":"MX","data":"mx.example.com","priority":10}`,
			status:   201, response: `{"id":7}`,
		},
		{
			method: "UpdateDNSRecord",
			call: func(ctx context.Context, c *Client) error {
				return c.UpdateDNSRecord(ctx, 42, 7, DNSRecord{Host: "www", Type: "A", Data: "192.0.2.1"})
			},
			wantMethod: "PUT", wantPath: "/domains/42/dns/7",
			wantBody: `{"host":"www","type":"A","data":"192.0.2.1"}`,
			status:   204,
		},
		{
			method:     "DeleteDNSRecord",
			call:       func(ctx context.Context, c *Client) error { return c.DeleteDNSRecord(ctx, 42, 7) },
			wantMethod: "DELETE", wantPath: "/domains/42/dns/7",
			status: 204,
		},
		{
			method:     "ListForwards",
			call:       func(ctx context.Context, c *Client) error { _, err := c.ListForwards(ctx, 42); return err },
			wantMethod: "GET", wantPath: "/domains/42/forwards/",
			status: 200, response: `[]`,
		},
		{
			method:     "GetForward",
			call:       func(ctx context.Context, c *Client) error { _, err := c.GetForward(ctx, 42, "www"); return err },
			wantMethod: "GET", wantPath: "/domains/42/forwards/www",
			status: 200, response: `{"host":"www","frame":false,"url":"https://example.com"}`,
		},
		{
			method: "CreateForward",
			call: func(ctx context.Context, c *Client) error {
				_, err := c.CreateForward(ctx, 42, Forward{Host: "www", URL: "https://example.com"})
				return err
			},
			wantMethod: "POST", wantPath: "/domains/42/forwards/",
			wantBody: `{"host":"www","frame":false,"url":"https://example.com"}`,
			status:   201,
		},
		{
			method: "UpdateForward",
			call: func(ctx context.Context, c *Client) error {
				_, err := c.UpdateForward(ctx, 42, "www", Forward{Host: "www", URL: "https://example.org", Frame: true})
				return err
			},
			wantMethod: "PUT", wantPath: "/domains/42/forwards/www",
			wantBody: `{"host":"www","frame":true,"url":"https://example.org"}`,
			status:   200, response: `{"host":"www","frame":true,"url":"https://example.org"}`,
		},
		{
			method:     "DeleteForward",
			call:       func(ctx context.Context, c *Client) error { return c.DeleteForward(ctx, 42, "www") },
			wantMethod: "DELETE", wantPath: "/domains/42/forwards/www",
			status: 204,
		},
		{
			method:     "ListInvoices",
			call:       func(ctx context.Context, c *Client) error { _, err := c.ListInvoices(ctx, "unpaid"); return err },
			wantMethod: "GET", wantPath: "/invoices", wantQuery: "status=unpaid",
			status: 200, response: `[]`,
		},
		{
			method:     "GetInvoice",
			call:       func(ctx context.Context, c *Client) error { _, err := c.GetInvoice(ctx, 1); return err },
			wantMethod: "GET", wantPath: "/invoices/1",
			status: 200, response: `{"id":1,"status":"paid"}`,
		},
		{
			method: "UpdateDynDNS",
			call: func(ctx context.Context, c *Client) error {
				return c.UpdateDynDNS(ctx, "home.example.com", "192.0.2.1")
			},
			wantMethod: "GET", wantPath: "/dyndns/update", wantQuery: "hostname=home.example.com&myip=192.0.2.1",
			status: 204,
		},
	}
}

// Each operation must produce exactly the request the Domeneshop API expects.
func TestOperationRequests(t *testing.T) {
	for _, op := range operations() {
		t.Run(op.method, func(t *testing.T) {
			var gotMethod, gotPath, gotQuery, gotBody, gotContentType string
			c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
				gotMethod, gotPath, gotQuery = r.Method, r.URL.Path, r.URL.RawQuery
				gotContentType = r.Header.Get("Content-Type")
				b, _ := io.ReadAll(r.Body)
				gotBody = string(b)
				if op.status != 0 {
					w.WriteHeader(op.status)
				}
				io.WriteString(w, op.response)
			})

			if err := op.call(context.Background(), c); err != nil {
				t.Fatalf("call failed: %v", err)
			}

			if gotMethod != op.wantMethod {
				t.Errorf("method = %s, want %s", gotMethod, op.wantMethod)
			}
			if gotPath != op.wantPath {
				t.Errorf("path = %q, want %q", gotPath, op.wantPath)
			}
			if gotQuery != op.wantQuery {
				t.Errorf("query = %q, want %q", gotQuery, op.wantQuery)
			}

			if op.wantBody == "" {
				if gotBody != "" {
					t.Errorf("body = %q, want none", gotBody)
				}
				return
			}
			if gotContentType != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", gotContentType)
			}
			assertSameJSON(t, gotBody, op.wantBody)
		})
	}
}

// A non-2xx response must reach the caller as an APIError from every
// operation, so no tool can report success on a failed call.
func TestOperationsReportAPIErrors(t *testing.T) {
	for _, op := range operations() {
		t.Run(op.method, func(t *testing.T) {
			c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusForbidden)
				io.WriteString(w, `{"code":"forbidden"}`)
			})

			err := op.call(context.Background(), c)
			if err == nil {
				t.Fatal("a 403 was reported as success")
			}
			var apiErr *APIError
			if !errors.As(err, &apiErr) || apiErr.StatusCode != http.StatusForbidden {
				t.Errorf("error = %v, want an *APIError with status 403", err)
			}
		})
	}
}

// The operations table is only meaningful if it covers the whole client, so
// adding a method without a table entry must fail here.
func TestEveryClientMethodIsExercised(t *testing.T) {
	covered := map[string]bool{}
	for _, op := range operations() {
		covered[op.method] = true
	}

	clientType := reflect.TypeOf(&Client{})
	var exported int
	for i := range clientType.NumMethod() {
		name := clientType.Method(i).Name
		exported++
		if !covered[name] {
			t.Errorf("Client.%s has no entry in the operations table", name)
		}
	}
	if exported != len(covered) {
		t.Errorf("client has %d exported methods but the table covers %d", exported, len(covered))
	}
}

func assertSameJSON(t *testing.T, got, want string) {
	t.Helper()
	var gotJSON, wantJSON any
	if err := json.Unmarshal([]byte(got), &gotJSON); err != nil {
		t.Fatalf("request body is not JSON: %v (%s)", err, got)
	}
	if err := json.Unmarshal([]byte(want), &wantJSON); err != nil {
		t.Fatalf("expected body is not JSON: %v", err)
	}
	if !reflect.DeepEqual(gotJSON, wantJSON) {
		t.Errorf("body = %s\nwant   %s", got, want)
	}
}
