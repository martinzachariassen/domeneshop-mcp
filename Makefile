BINARY    := domeneshop-mcp
MODULE    := github.com/martinzachariassen/domeneshop-mcp
VERSION   := $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS   := -s -w -X $(MODULE)/internal/version.version=$(VERSION)

# GOOS/GOARCH pairs to build prebuilt binaries for.
PLATFORMS := darwin/amd64 darwin/arm64 linux/amd64 linux/arm64

.PHONY: build dist install clean

build:
	go build -trimpath -ldflags "$(LDFLAGS)" -o bin/$(BINARY) .

# Cross-compiles a binary per platform into dist/, plus a checksums file.
# Needs no external tooling: Go cross-compiles out of the box via GOOS/GOARCH.
dist: clean
	@mkdir -p dist
	@for platform in $(PLATFORMS); do \
		os=$${platform%/*}; arch=$${platform#*/}; \
		out=dist/$(BINARY)_$${os}_$${arch}; \
		echo "building $$out"; \
		GOOS=$$os GOARCH=$$arch go build -trimpath -ldflags "$(LDFLAGS)" -o $$out . || exit 1; \
	done
	@cd dist && shasum -a 256 * > checksums.txt
# Builds and installs into $GOBIN (or $GOPATH/bin / ~/go/bin), same as
# `go install github.com/martinzachariassen/domeneshop-mcp@latest` would.
install:
	go install -trimpath -ldflags "$(LDFLAGS)" .

clean:
	rm -rf bin dist
