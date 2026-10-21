import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENV_HELP } from "../src/config.js";
import { connect, listToolsByName } from "./support/mcpHarness.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(path.join(repoRoot, file), "utf8"));

const pkg = readJson("package.json") as { name: string; version: string; mcpName: string };
const server = readJson("server.json") as {
  name: string;
  version: string;
  packages: { identifier: string; version: string; environmentVariables: { name: string }[] }[];
};
const manifest = readJson("mcpb/manifest.json") as {
  version: string;
  tools: { name: string }[];
};

// These files are published to the MCP Registry and as a Claude Desktop bundle;
// `npm run version` keeps them in sync, and this catches anything that slips.
describe("distribution metadata", () => {
  it("uses the package.json version everywhere", () => {
    expect(server.version).toBe(pkg.version);
    expect(manifest.version).toBe(pkg.version);
    for (const entry of server.packages) {
      expect(entry.version).toBe(pkg.version);
    }
  });

  it("names the server the same in server.json and package.json mcpName", () => {
    expect(server.name).toBe(pkg.mcpName);
    expect(server.packages[0]?.identifier).toBe(pkg.name);
  });

  it("documents every environment variable the CLI reads", () => {
    const documented = server.packages[0]?.environmentVariables.map((env) => env.name) ?? [];
    const read = [...ENV_HELP.matchAll(/^\s+(DOMENESHOP_\w+)/gm)].map((match) => match[1]);
    expect(documented.sort()).toEqual(read.sort());
  });

  it("lists exactly the tools the server registers in the bundle manifest", async () => {
    const harness = await connect((_req, res) => res.end());
    try {
      const tools = await listToolsByName(harness.client);
      expect(manifest.tools.map((tool) => tool.name).sort()).toEqual([...tools.keys()].sort());
    } finally {
      await harness.close();
    }
  });
});
