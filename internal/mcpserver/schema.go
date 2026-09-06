package mcpserver

import (
	"fmt"

	"github.com/google/jsonschema-go/jsonschema"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// inputSchema infers the JSON schema for an argument struct and pins the named
// properties to a fixed set of values, so clients see the accepted values as
// data rather than only as prose in the description.
//
// Only required properties should be constrained this way: an optional filter
// left out of a call is fine, but a client that passes it as an empty string
// would fail validation against an enum that has no empty member.
//
// It panics on a property name that does not exist, which is a registration
// bug in this package rather than anything a caller can hit at runtime — the
// same reasoning as mcp.AddTool panicking on a missing schema.
func inputSchema[T any](enums map[string][]string) *jsonschema.Schema {
	s, err := jsonschema.For[T](nil)
	if err != nil {
		panic(fmt.Errorf("infer schema for %T: %w", *new(T), err))
	}
	for name, values := range enums {
		prop, ok := s.Properties[name]
		if !ok {
			panic(fmt.Errorf("infer schema for %T: no property %q", *new(T), name))
		}
		prop.Enum = make([]any, len(values))
		for i, v := range values {
			prop.Enum[i] = v
		}
	}
	return s
}

// Annotation presets. The MCP spec treats these as hints clients use to decide
// what may run without asking the user, so every tool declares them explicitly
// instead of relying on defaults.

// readOnly marks a tool that only reads state.
func readOnly() *mcp.ToolAnnotations {
	return &mcp.ToolAnnotations{ReadOnlyHint: true, IdempotentHint: true}
}

// additive marks a tool that creates new state without replacing any.
func additive() *mcp.ToolAnnotations {
	no := false
	return &mcp.ToolAnnotations{DestructiveHint: &no}
}

// destructive marks a tool that overwrites or removes existing state. Repeating
// the same call leaves the same result, hence idempotent.
func destructive() *mcp.ToolAnnotations {
	yes := true
	return &mcp.ToolAnnotations{DestructiveHint: &yes, IdempotentHint: true}
}
