package mcpserver

import (
	"encoding/json"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// jsonResult marshals v as indented JSON and returns it as a tool text result.
func jsonResult(v any) (*mcp.CallToolResult, any, error) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return nil, nil, fmt.Errorf("marshal result: %w", err)
	}
	return textResult(string(b))
}

// textResult wraps a plain string as a tool text result.
func textResult(s string) (*mcp.CallToolResult, any, error) {
	return &mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: s}},
	}, nil, nil
}
