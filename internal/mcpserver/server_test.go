package mcpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/martinzachariassen/domeneshop-mcp/internal/domeneshop"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// connect starts the MCP server against a Domeneshop API stubbed by handler,
// and returns a connected client session.
func connect(t *testing.T, handler http.HandlerFunc) *mcp.ClientSession {
	t.Helper()
	api := httptest.NewServer(handler)
	t.Cleanup(api.Close)

	client := domeneshop.NewClient("token", "secret", domeneshop.WithBaseURL(api.URL))
	server := New(client)

	clientTransport, serverTransport := mcp.NewInMemoryTransports()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go server.Run(ctx, serverTransport)

	session, err := mcp.NewClient(&mcp.Implementation{Name: "test"}, nil).
		Connect(ctx, clientTransport, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { session.Close() })
	return session
}

func listTools(t *testing.T, session *mcp.ClientSession) map[string]*mcp.Tool {
	t.Helper()
	res, err := session.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	tools := map[string]*mcp.Tool{}
	for _, tool := range res.Tools {
		tools[tool.Name] = tool
	}
	return tools
}

// One tool per Domeneshop API operation.
func TestServerRegistersEveryOperation(t *testing.T) {
	session := connect(t, func(w http.ResponseWriter, r *http.Request) {})
	tools := listTools(t, session)

	want := []string{
		"list_domains", "get_domain",
		"list_dns_records", "get_dns_record", "create_dns_record", "update_dns_record", "delete_dns_record",
		"list_forwards", "get_forward", "create_forward", "update_forward", "delete_forward",
		"list_invoices", "get_invoice",
		"update_dyndns",
	}
	for _, name := range want {
		if _, ok := tools[name]; !ok {
			t.Errorf("tool %q is not registered", name)
		}
	}
	if len(tools) != len(want) {
		t.Errorf("got %d tools, want %d", len(tools), len(want))
	}
}

// Clients use the hints to decide what may run without asking the user, so a
// missing or wrong hint is a real defect.
func TestToolAnnotations(t *testing.T) {
	session := connect(t, func(w http.ResponseWriter, r *http.Request) {})
	tools := listTools(t, session)

	readOnlyTools := []string{
		"list_domains", "get_domain", "list_dns_records", "get_dns_record",
		"list_forwards", "get_forward", "list_invoices", "get_invoice",
	}
	destructiveTools := []string{
		"update_dns_record", "delete_dns_record",
		"update_forward", "delete_forward", "update_dyndns",
	}
	additiveTools := []string{"create_dns_record", "create_forward"}

	for name, tool := range tools {
		if tool.Annotations == nil {
			t.Errorf("tool %q has no annotations", name)
		}
	}
	for _, name := range readOnlyTools {
		if a := tools[name].Annotations; a == nil || !a.ReadOnlyHint {
			t.Errorf("tool %q: want readOnlyHint true", name)
		}
	}
	for _, name := range destructiveTools {
		a := tools[name].Annotations
		if a == nil || a.ReadOnlyHint {
			t.Errorf("tool %q: want readOnlyHint false", name)
			continue
		}
		if a.DestructiveHint == nil || !*a.DestructiveHint {
			t.Errorf("tool %q: want destructiveHint true", name)
		}
	}
	for _, name := range additiveTools {
		a := tools[name].Annotations
		if a == nil || a.ReadOnlyHint {
			t.Errorf("tool %q: want readOnlyHint false", name)
			continue
		}
		if a.DestructiveHint == nil || *a.DestructiveHint {
			t.Errorf("tool %q: want destructiveHint false", name)
		}
	}
}

// schemaOf renders a tool's input schema as a generic map.
func schemaOf(t *testing.T, tool *mcp.Tool) map[string]any {
	t.Helper()
	b, err := json.Marshal(tool.InputSchema)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

// The write tools must expose the fields of every record type, or those types
// cannot be created through the server at all.
func TestDNSWriteToolsExposeEveryTypeSpecificField(t *testing.T) {
	session := connect(t, func(w http.ResponseWriter, r *http.Request) {})
	tools := listTools(t, session)

	want := []string{
		"host", "type", "data", "ttl",
		"priority", "weight", "port",
		"usage", "selector", "dtype",
		"alg", "digest",
		"flags", "tag",
	}
	for _, name := range []string{"create_dns_record", "update_dns_record"} {
		props, _ := schemaOf(t, tools[name])["properties"].(map[string]any)
		for _, field := range want {
			if _, ok := props[field]; !ok {
				t.Errorf("%s: input schema is missing %q", name, field)
			}
		}
		if _, ok := props["domain_id"]; !ok {
			t.Errorf("%s: input schema is missing domain_id", name)
		}
	}
	// update_dns_record embeds the shared record arguments; the record ID has
	// to survive that flattening.
	props, _ := schemaOf(t, tools["update_dns_record"])["properties"].(map[string]any)
	if _, ok := props["record_id"]; !ok {
		t.Error("update_dns_record: input schema is missing record_id")
	}
}

func TestDNSRecordTypeEnum(t *testing.T) {
	session := connect(t, func(w http.ResponseWriter, r *http.Request) {})
	tools := listTools(t, session)

	for _, name := range []string{"create_dns_record", "update_dns_record"} {
		props := schemaOf(t, tools[name])["properties"].(map[string]any)
		typeProp := props["type"].(map[string]any)
		enum, ok := typeProp["enum"].([]any)
		if !ok {
			t.Errorf("%s: type property has no enum", name)
			continue
		}
		var got []string
		for _, v := range enum {
			got = append(got, v.(string))
		}
		if !slices.Equal(got, domeneshop.RecordTypes) {
			t.Errorf("%s: type enum = %v, want %v", name, got, domeneshop.RecordTypes)
		}
	}
}

// An optional filter must stay enum-free, so a client passing an empty string
// is not rejected by schema validation.
func TestOptionalFiltersAreNotConstrainedByEnum(t *testing.T) {
	session := connect(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("[]"))
	})
	tools := listTools(t, session)

	for name, prop := range map[string]string{"list_dns_records": "type", "list_invoices": "status"} {
		props := schemaOf(t, tools[name])["properties"].(map[string]any)
		if _, ok := props[prop].(map[string]any)["enum"]; ok {
			t.Errorf("%s: %q should not carry an enum", name, prop)
		}
	}

	res, err := session.CallTool(context.Background(), &mcp.CallToolParams{
		Name:      "list_invoices",
		Arguments: map[string]any{"status": ""},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.IsError {
		t.Errorf("empty status filter was rejected: %s", resultText(res))
	}
}

func resultText(res *mcp.CallToolResult) string {
	var b strings.Builder
	for _, c := range res.Content {
		if tc, ok := c.(*mcp.TextContent); ok {
			b.WriteString(tc.Text)
		}
	}
	return b.String()
}

// A CAA record has to survive the whole path: tool arguments, client, HTTP body.
func TestCreateDNSRecordEndToEnd(t *testing.T) {
	var got map[string]any
	session := connect(t, func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"id":99}`))
	})

	res, err := session.CallTool(context.Background(), &mcp.CallToolParams{
		Name: "create_dns_record",
		Arguments: map[string]any{
			"domain_id": 42, "host": "@", "type": "CAA",
			"data": "letsencrypt.org", "flags": 0, "tag": "issue",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.IsError {
		t.Fatalf("tool returned an error: %s", resultText(res))
	}

	if got["type"] != "CAA" || got["tag"] != "issue" || got["flags"] != float64(0) {
		t.Errorf("request body = %v", got)
	}
	if !strings.Contains(resultText(res), "99") {
		t.Errorf("result = %q, want the new record ID", resultText(res))
	}
}

// An unknown record type is caught by schema validation, before any request.
func TestCreateDNSRecordRejectsUnknownType(t *testing.T) {
	called := false
	session := connect(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
	})

	res, err := session.CallTool(context.Background(), &mcp.CallToolParams{
		Name: "create_dns_record",
		Arguments: map[string]any{
			"domain_id": 42, "host": "@", "type": "SPF", "data": "x",
		},
	})
	if err == nil && !res.IsError {
		t.Error("an unknown record type was accepted")
	}
	if called {
		t.Error("an invalid record reached the Domeneshop API")
	}
}

// create_forward must report the forward it made, not an empty object.
func TestCreateForwardEndToEnd(t *testing.T) {
	session := connect(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", "/domains/42/forwards/www")
		w.WriteHeader(http.StatusCreated)
	})

	res, err := session.CallTool(context.Background(), &mcp.CallToolParams{
		Name: "create_forward",
		Arguments: map[string]any{
			"domain_id": 42, "host": "www", "url": "https://example.com",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.IsError {
		t.Fatalf("tool returned an error: %s", resultText(res))
	}

	text := resultText(res)
	if !strings.Contains(text, "www") || !strings.Contains(text, "https://example.com") {
		t.Errorf("result = %q, want the created forward", text)
	}
}

// API failures reach the client as tool errors, not as protocol errors.
func TestAPIErrorSurfacesAsToolError(t *testing.T) {
	session := connect(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"code":"authentication:failed"}`))
	})

	res, err := session.CallTool(context.Background(), &mcp.CallToolParams{
		Name:      "list_domains",
		Arguments: map[string]any{},
	})
	if err != nil {
		t.Fatalf("call failed at the protocol level: %v", err)
	}
	if !res.IsError {
		t.Fatal("a 401 was not reported as a tool error")
	}
	if !strings.Contains(resultText(res), "401") {
		t.Errorf("result = %q, want the status code", resultText(res))
	}
}
