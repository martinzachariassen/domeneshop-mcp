#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { run } from "./cli.js";

const code = await run(process.argv.slice(2), process.env, {
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
  connect: (server) => server.connect(new StdioServerTransport()),
  onSignal: (signal, handler) => process.once(signal, handler),
  exit: (exitCode) => process.exit(exitCode),
});
if (code !== undefined) {
  process.exitCode = code;
}
