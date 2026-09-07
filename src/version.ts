import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

/** The published package version, read from package.json at runtime. */
export const VERSION: string = packageJson.version;
