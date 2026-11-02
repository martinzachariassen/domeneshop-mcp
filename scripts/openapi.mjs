#!/usr/bin/env node
// Domeneshop publishes its OpenAPI spec only embedded in the Redoc docs page.
// `--update` stores it as the contract-test fixture; `--check` exits 1 if the
// published spec differs from the fixture and prints the changed paths.
import { readFile, writeFile } from "node:fs/promises";

const DOCS_URL = "https://api.domeneshop.no/docs/";
const FIXTURE = new URL("../test/contract/domeneshop-openapi.json", import.meta.url);
const MARKER = "__redoc_state = ";

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(/** @type {Record<string, unknown>} */ (value)[key])]),
    );
  }
  return value;
}

/** @returns {Promise<unknown>} */
async function fetchSpec() {
  const response = await fetch(DOCS_URL);
  if (!response.ok) {
    throw new Error(`GET ${DOCS_URL} returned ${String(response.status)}`);
  }
  const html = await response.text();
  const start = html.indexOf(MARKER);
  if (start === -1) {
    throw new Error(`no ${MARKER.trim()} found in ${DOCS_URL}; the docs page changed format`);
  }
  const end = html.indexOf(";\n", start);
  const state = JSON.parse(html.slice(start + MARKER.length, end));
  return sortKeys(state.spec.data);
}

/**
 * @param {any} a
 * @param {any} b
 * @param {string} path
 * @param {string[]} out
 * @returns {string[]}
 */
function diffPaths(a, b, path = "", out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) {
    return out;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      diffPaths(a[key], b[key], `${path}/${key}`, out);
    }
  } else {
    out.push(path || "/");
  }
  return out;
}

const mode = process.argv[2];
if (mode !== "--check" && mode !== "--update") {
  console.error("usage: openapi.mjs --check | --update");
  process.exit(2);
}

const published = await fetchSpec();
if (mode === "--update") {
  await writeFile(FIXTURE, `${JSON.stringify(published, null, 2)}\n`);
  console.log(`wrote ${FIXTURE.pathname}`);
} else {
  const stored = sortKeys(JSON.parse(await readFile(FIXTURE, "utf8")));
  if (JSON.stringify(stored) === JSON.stringify(published)) {
    console.log("Domeneshop OpenAPI spec matches the fixture.");
  } else {
    const changed = diffPaths(stored, published);
    console.log(
      "Domeneshop's published OpenAPI spec differs from test/contract/domeneshop-openapi.json:",
    );
    for (const path of changed) {
      console.log(`  ${path}`);
    }
    console.log(
      "Run `npm run spec:update`, review the diff and update the client and contract tests.",
    );
    process.exit(1);
  }
}
