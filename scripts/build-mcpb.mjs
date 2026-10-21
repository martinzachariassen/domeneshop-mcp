#!/usr/bin/env node
// Builds domeneshop-mcp-<version>.mcpb, a one-click install bundle for Claude
// Desktop. Run `npm run build` first. The bundle contains the compiled server,
// its production dependencies and mcpb/manifest.json.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const staging = path.join(root, "mcpb", "build");
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const output = path.join(root, `domeneshop-mcp-${version}.mcpb`);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

if (!existsSync(path.join(root, "dist", "index.js"))) {
  console.error("dist/index.js is missing; run `npm run build` first.");
  process.exit(1);
}

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
for (const file of ["package.json", "package-lock.json", "README.md", "LICENSE", "dist"]) {
  cpSync(path.join(root, file), path.join(staging, file), { recursive: true });
}
cpSync(path.join(root, "mcpb", "manifest.json"), path.join(staging, "manifest.json"));

// --ignore-scripts skips the husky `prepare` hook, which needs devDependencies.
execFileSync(npm, ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
  cwd: staging,
  stdio: "inherit",
});
execFileSync(npx, ["--yes", "@anthropic-ai/mcpb@2.1.2", "pack", staging, output], {
  stdio: "inherit",
});

console.log(`Built ${path.relative(root, output)}`);
