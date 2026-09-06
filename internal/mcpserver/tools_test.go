package mcpserver

import (
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// toolCall is one MCP tool exercised over the protocol with realistic
// arguments, and the Domeneshop request it is expected to produce.
//
// Every registered tool has an entry here, and TestEveryToolIsExercised fails
// if a tool is added without one.
type toolCall struct {
	tool string
	args map[string]any

	wantMethod string
	wantPath   string

	status   int
	response string
}

func toolCalls() []toolCall {
	return []toolCall{
		{
			tool: "list_domains", args: map[string]any{},
			wantMethod: "GET", wantPath: "/domains",
			status: 200, response: `[{"id":42,"domain":"example.com"}]`,
		},
		{
			tool: "get_domain", args: map[string]any{"domain_id": 42},
			wantMethod: "GET", wantPath: "/domains/42",
			status: 200, response: `{"id":42,"domain":"example.com"}`,
		},
		{
			tool: "list_dns_records", args: map[string]any{"domain_id": 42},
			wantMethod: "GET", wantPath: "/domains/42/dns",
			status: 200, response: `[{"id":7,"host":"www","type":"A","data":"192.0.2.1"}]`,
		},
		{
			tool: "get_dns_record", args: map[string]any{"domain_id": 42, "record_id": 7},
			wantMethod: "GET", wantPath: "/domains/42/dns/7",
			status: 200, response: `{"id":7,"host":"www","type":"A","data":"192.0.2.1"}`,
		},
		{
			tool:       "create_dns_record",
			args:       map[string]any{"domain_id": 42, "host": "www", "type": "A", "data": "192.0.2.1"},
			wantMethod: "POST", wantPath: "/domains/42/dns",
			status: 201, response: `{"id":7}`,
		},
		{
			tool:       "update_dns_record",
			args:       map[string]any{"domain_id": 42, "record_id": 7, "host": "www", "type": "A", "data": "192.0.2.2"},
			wantMethod: "PUT", wantPath: "/domains/42/dns/7",
			status: 204,
		},
		{
			tool: "delete_dns_record", args: map[string]any{"domain_id": 42, "record_id": 7},
			wantMethod: "DELETE", wantPath: "/domains/42/dns/7",
			status: 204,
		},
		{
			tool: "list_forwards", args: map[string]any{"domain_id": 42},
			wantMethod: "GET", wantPath: "/domains/42/forwards/",
			status: 200, response: `[{"host":"www","frame":false,"url":"https://example.com"}]`,
		},
		{
			tool: "get_forward", args: map[string]any{"domain_id": 42, "host": "www"},
			wantMethod: "GET", wantPath: "/domains/42/forwards/www",
			status: 200, response: `{"host":"www","frame":false,"url":"https://example.com"}`,
		},
		{
			tool:       "create_forward",
			args:       map[string]any{"domain_id": 42, "host": "www", "url": "https://example.com"},
			wantMethod: "POST", wantPath: "/domains/42/forwards/",
			status: 201,
		},
		{
			tool:       "update_forward",
			args:       map[string]any{"domain_id": 42, "host": "www", "url": "https://example.org"},
			wantMethod: "PUT", wantPath: "/domains/42/forwards/www",
			status: 200, response: `{"host":"www","frame":false,"url":"https://example.org"}`,
		},
		{
			tool: "delete_forward", args: map[string]any{"domain_id": 42, "host": "www"},
			wantMethod: "DELETE", wantPath: "/domains/42/forwards/www",
			status: 204,
		},
		{
			tool: "list_invoices", args: map[string]any{},
			wantMethod: "GET", wantPath: "/invoices",
			status: 200, response: `[{"id":1,"status":"paid"}]`,
		},
		{
			tool: "get_invoice", args: map[string]any{"invoice_id": 1},
			wantMethod: "GET", wantPath: "/invoices/1",
			status: 200, response: `{"id":1,"status":"paid"}`,
		},
		{
			tool: "update_dyndns", args: map[string]any{"hostname": "home.example.com", "myip": "192.0.2.1"},
			wantMethod: "GET", wantPath: "/dyndns/update",
			status: 204,
		},
	}
}

// Every tool must pass schema validation with realistic arguments, reach the
// right Domeneshop endpoint, and report a non-error result.
func TestToolCalls(t *testing.T) {
	for _, tc := range toolCalls() {
		t.Run(tc.tool, func(t *testing.T) {
			var gotMethod, gotPath string
			session := connect(t, func(w http.ResponseWriter, r *http.Request) {
				gotMethod, gotPath = r.Method, r.URL.Path
				if tc.status != 0 {
					w.WriteHeader(tc.status)
				}
				_, _ = io.WriteString(w, tc.response)
			})

			res, err := session.CallTool(context.Background(), &mcp.CallToolParams{
				Name: tc.tool, Arguments: tc.args,
			})
			if err != nil {
				t.Fatalf("call failed at the protocol level: %v", err)
			}
			if res.IsError {
				t.Fatalf("tool returned an error: %s", resultText(res))
			}
			if resultText(res) == "" {
				t.Error("tool returned no content")
			}

			if gotMethod != tc.wantMethod {
				t.Errorf("method = %s, want %s", gotMethod, tc.wantMethod)
			}
			if gotPath != tc.wantPath {
				t.Errorf("path = %q, want %q", gotPath, tc.wantPath)
			}
		})
	}
}

// A failing API call must reach the client as a tool error from every tool, so
// no tool can quietly report success on a failed call.
func TestToolCallsReportAPIErrors(t *testing.T) {
	for _, tc := range toolCalls() {
		t.Run(tc.tool, func(t *testing.T) {
			session := connect(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusForbidden)
				_, _ = io.WriteString(w, `{"code":"forbidden"}`)
			})

			res, err := session.CallTool(context.Background(), &mcp.CallToolParams{
				Name: tc.tool, Arguments: tc.args,
			})
			if err != nil {
				t.Fatalf("call failed at the protocol level: %v", err)
			}
			if !res.IsError {
				t.Fatalf("a 403 was reported as success: %s", resultText(res))
			}
		})
	}
}

// Calling a tool with no arguments at all must fail on the missing required
// ones rather than reaching the API with a zero domain ID.
func TestToolsRequireTheirArguments(t *testing.T) {
	needArgs := map[string]bool{}
	for _, tc := range toolCalls() {
		needArgs[tc.tool] = len(tc.args) > 0
	}

	for tool, required := range needArgs {
		if !required {
			continue
		}
		t.Run(tool, func(t *testing.T) {
			called := false
			session := connect(t, func(w http.ResponseWriter, r *http.Request) {
				called = true
			})

			res, err := session.CallTool(context.Background(), &mcp.CallToolParams{
				Name: tool, Arguments: map[string]any{},
			})
			if err == nil && !res.IsError {
				t.Error("a call with no arguments was accepted")
			}
			if called {
				t.Error("a call with no arguments reached the Domeneshop API")
			}
		})
	}
}

// The table is only meaningful if it covers every registered tool.
func TestEveryToolIsExercised(t *testing.T) {
	session := connect(t, func(w http.ResponseWriter, r *http.Request) {})
	registered := listTools(t, session)

	covered := map[string]bool{}
	for _, tc := range toolCalls() {
		covered[tc.tool] = true
		if _, ok := registered[tc.tool]; !ok {
			t.Errorf("table exercises %q, which is not a registered tool", tc.tool)
		}
	}
	for name := range registered {
		if !covered[name] {
			t.Errorf("tool %q has no entry in the tool call table", name)
		}
	}
}
