import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

describe("CLI entry point", () => {
  it("prints the version and exits successfully", async () => {
    const result = await runCli(["--version"], baseEnv);

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(`domeneshop-mcp ${VERSION}`);
    expect(result.stderr).toBe("");
  }, 10000);

  it("accepts the single-dash -version alias", async () => {
    const result = await runCli(["-version"], baseEnv);

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(`domeneshop-mcp ${VERSION}`);
  }, 10000);

  it("exits with an error when credentials are missing", async () => {
    const result = await runCli([], baseEnv);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("DOMENESHOP_API_TOKEN and DOMENESHOP_API_SECRET must be set");
  }, 10000);

  it("exits with an error when only one credential is set", async () => {
    const result = await runCli([], { ...baseEnv, DOMENESHOP_API_TOKEN: "token" });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("DOMENESHOP_API_TOKEN and DOMENESHOP_API_SECRET must be set");
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
