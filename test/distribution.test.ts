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

// The README's one-click install links carry the server config encoded in the
// URL, so a typo there would only surface when a user clicks the button.
describe("README install links", () => {
  const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const links = (prefix: string): URL[] =>
    [...readme.matchAll(/https:\/\/[^\s"')]+/g)]
      .map((match) => match[0])
      .filter((href) => href.startsWith(prefix))
      .map((href) => new URL(href));

  type ServerConfig = { command: string; args: string[]; env: Record<string, string> };
  const expectServerConfig = (config: ServerConfig): void => {
    expect(config.command).toBe("npx");
    expect(config.args).toEqual(["-y", pkg.name]);
    expect(Object.keys(config.env).sort()).toEqual([
      "DOMENESHOP_API_SECRET",
      "DOMENESHOP_API_TOKEN",
    ]);
  };

  it("encodes a valid config in every Cursor link", () => {
    const cursor = links("https://cursor.com/en/install-mcp");
    expect(cursor.length).toBeGreaterThan(0);
    for (const url of cursor) {
      expect(url.searchParams.get("name")).toBe("domeneshop");
      const encoded = url.searchParams.get("config") ?? "";
      expectServerConfig(
        JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as ServerConfig,
      );
    }
  });

  it("encodes a valid config with password inputs in every VS Code link", () => {
    const vscode = links("https://insiders.vscode.dev/redirect/mcp/install");
    expect(vscode.length).toBeGreaterThan(0);
    for (const url of vscode) {
      expect(url.searchParams.get("name")).toBe("domeneshop");
      const config = JSON.parse(url.searchParams.get("config") ?? "") as ServerConfig;
      expectServerConfig(config);

      const inputs = JSON.parse(url.searchParams.get("inputs") ?? "") as {
        id: string;
        password?: boolean;
      }[];
      for (const value of Object.values(config.env)) {
        const id = /^\$\{input:(\w+)\}$/.exec(value)?.[1];
        expect(id, `env value ${value} should reference an input`).toBeDefined();
        expect(inputs.find((input) => input.id === id)?.password).toBe(true);
      }
    }
  });
});
