import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";
import { VERSION } from "../src/version.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(testDir, "..");
const tsxBin = path.join(repoRoot, "node_modules", ".bin", "tsx");
const cliPath = path.join(repoRoot, "src", "index.ts");

const baseEnv = { ...process.env };
delete baseEnv["DOMENESHOP_API_TOKEN"];
delete baseEnv["DOMENESHOP_API_SECRET"];

interface CliResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(tsxBin, [cliPath, ...args], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const killTimer = setTimeout(() => {
      child.kill();
      reject(new Error(`domeneshop-mcp did not exit in time; stdout=${stdout} stderr=${stderr}`));
    }, 8000);

    child.on("error", (error) => {
      clearTimeout(killTimer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(killTimer);
      resolve({ stdout, stderr, code });
    });

    child.stdin.end();
  });
}

/** Only what needs a real process: exit codes, stdio and signals. The rest is in cli.test.ts. */
describe("CLI entry point", () => {
  it("prints the version and exits successfully", async () => {
    const result = await runCli(["--version"], baseEnv);

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(`domeneshop-mcp ${VERSION}`);
    expect(result.stderr).toBe("");
  }, 10000);

  it("exits with an error when credentials are missing", async () => {
    const result = await runCli([], baseEnv);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("DOMENESHOP_API_TOKEN and DOMENESHOP_API_SECRET must be set");
  }, 10000);

  it("exposes only read-only tools over stdio when DOMENESHOP_READ_ONLY is set", async () => {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(baseEnv)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    const transport = new StdioClientTransport({
      command: tsxBin,
      args: [cliPath],
      env: {
        ...env,
        DOMENESHOP_API_TOKEN: "token",
        DOMENESHOP_API_SECRET: "secret",
        DOMENESHOP_READ_ONLY: "true",
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "cli-test", version: "1.0.0" });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(8);
      expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    } finally {
      await client.close();
    }
  }, 15000);

  it("shuts down cleanly on SIGTERM", async () => {
    const child = spawn(tsxBin, [cliPath], {
      env: { ...baseEnv, DOMENESHOP_API_TOKEN: "token", DOMENESHOP_API_SECRET: "secret" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    // Leave stdin open so only the signal can end the process.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const exited = new Promise<number | null>((resolve) => {
      child.on("exit", (code) => resolve(code));
    });
    child.kill("SIGTERM");
    const code = await Promise.race([
      exited,
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 5000)),
    ]);
    if (code === "timeout") {
      child.kill("SIGKILL");
    }
    expect(code).toBe(0);
  }, 10000);

  it("connects over stdio once credentials are present", async () => {
    const result = await runCli([], {
      ...baseEnv,
      DOMENESHOP_API_TOKEN: "token",
      DOMENESHOP_API_SECRET: "secret",
    });

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
  }, 10000);
});
