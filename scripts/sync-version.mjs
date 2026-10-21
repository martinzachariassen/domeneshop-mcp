#!/usr/bin/env node
// Copies the version from package.json into server.json (MCP Registry) and
// mcpb/manifest.json (Claude Desktop bundle). Runs after `changeset version`
// via `npm run version`; test/distribution.test.ts fails if they drift.
import { readFileSync, writeFileSync } from "node:fs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const { version } = readJson("package.json");

const server = readJson("server.json");
server.version = version;
for (const pkg of server.packages) {
  pkg.version = version;
}
writeJson("server.json", server);

const manifest = readJson("mcpb/manifest.json");
manifest.version = version;
writeJson("mcpb/manifest.json", manifest);

console.log(`server.json and mcpb/manifest.json set to ${version}`);
