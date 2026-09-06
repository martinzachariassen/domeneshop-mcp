// Package version reports the domeneshop-mcp build version.
package version

import "runtime/debug"

// version is set at build time via:
// -ldflags "-X github.com/martinzachariassen/domeneshop-mcp/internal/version.version=..."
var version string

// String returns the build version: the ldflags-injected value if set
// (used for locally cross-compiled binaries), otherwise the module version
// reported by `go install module@version` (used when installed remotely),
// falling back to "dev".
func String() string {
	if version != "" {
		return version
	}
	if info, ok := debug.ReadBuildInfo(); ok && info.Main.Version != "" && info.Main.Version != "(devel)" {
		return info.Main.Version
	}
	return "dev"
}
