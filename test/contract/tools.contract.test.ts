import { describe, expect, it } from "vitest";
import { connectTo, listToolsByName, resultText } from "#testing/mcpHarness.js";
import {
  CREDIT_NOTE,
  DOMAIN_FULL,
  FORWARD_FULL,
  INVOICE_FULL,
  RECORDS,
  startSpecServer,
} from "./specServer.js";

type Args = Record<string, unknown>;

function recordArgs(record: Record<string, unknown>): Args {
  const { id: _id, ...fields } = record;
  return { domain_id: 1, ...fields };
}

/** Valid arguments for every tool, and the operations each call must reach. */
const CALLS: [string, Args, string[]][] = [
  ["list_domains", { filter: ".no" }, ["GET /domains"]],
  ["get_domain", { domain_id: 1 }, ["GET /domains/{domainId}"]],
  ["list_dns_records", { domain_id: 1, host: "www", type: "A" }, ["GET /domains/{domainId}/dns"]],
  ["get_dns_record", { domain_id: 1, record_id: 1 }, ["GET /domains/{domainId}/dns/{recordId}"]],
  [
    "create_dns_record",
    recordArgs(RECORDS.TXT),
    ["POST /domains/{domainId}/dns", "GET /domains/{domainId}/dns/{recordId}"],
  ],
  [
    "update_dns_record",
    { ...recordArgs(RECORDS.A), record_id: 1 },
    ["PUT /domains/{domainId}/dns/{recordId}", "GET /domains/{domainId}/dns/{recordId}"],
  ],
  [
    "patch_dns_record",
    { domain_id: 1, record_id: 1, ttl: 600 },
    ["GET /domains/{domainId}/dns/{recordId}", "PUT /domains/{domainId}/dns/{recordId}"],
  ],
  [
    "upsert_dns_record",
    recordArgs(RECORDS.A),
    [
      "GET /domains/{domainId}/dns",
      "PUT /domains/{domainId}/dns/{recordId}",
      "GET /domains/{domainId}/dns/{recordId}",
    ],
  ],
  [
    "delete_dns_record",
    { domain_id: 1, record_id: 1 },
    ["DELETE /domains/{domainId}/dns/{recordId}"],
  ],
  ["list_forwards", { domain_id: 1 }, ["GET /domains/{domainId}/forwards/"]],
  ["get_forward", { domain_id: 1, host: "@" }, ["GET /domains/{domainId}/forwards/{host}"]],
  ["create_forward", { domain_id: 1, ...FORWARD_FULL }, ["POST /domains/{domainId}/forwards/"]],
  [
    "update_forward",
    { domain_id: 1, host: "www", url: "ftp://ftp.example.com", frame: true },
    ["PUT /domains/{domainId}/forwards/{host}"],
  ],
  [
    "update_forward",
    { domain_id: 1, host: "www", url: "https://example.com" },
    ["GET /domains/{domainId}/forwards/{host}", "PUT /domains/{domainId}/forwards/{host}"],
  ],
  ["delete_forward", { domain_id: 1, host: "www" }, ["DELETE /domains/{domainId}/forwards/{host}"]],
  ["list_invoices", { status: "settled" }, ["GET /invoices"]],
  ["get_invoice", { invoice_id: 1 }, ["GET /invoices/{invoiceId}"]],
  [
    "update_dyndns",
    { hostname: "example.com, www.example.com", myip: "192.0.2.1, 2001:db8::1" },
    ["GET /dyndns/update"],
  ],
];

async function callAgainstSpec(name: string, args: Args) {
  const apiServer = await startSpecServer();
  const harness = await connectTo(apiServer);
  try {
    const result = await harness.client.callTool({ name, arguments: args });
    return {
      result,
      violations: apiServer.violations,
      operations: apiServer.requests.map((r) => r.method),
      hits: [...apiServer.hits],
      tools: await listToolsByName(harness.client),
    };
  } finally {
    await harness.close();
  }
}

describe("MCP tools against the Domeneshop spec", () => {
  it("has a contract case for every tool", async () => {
    const { tools } = await callAgainstSpec("list_domains", {});
    expect([...tools.keys()].sort()).toEqual([...new Set(CALLS.map(([name]) => name))].sort());
  });

  it.each(CALLS)("%s sends only requests the spec accepts", async (name, args, expected) => {
    const { result, violations, hits, tools } = await callAgainstSpec(name, args);

    expect(resultText(result)).not.toMatch(/^domeneshop:|error/i);
    expect(result.isError).not.toBe(true);
    expect(violations).toEqual([]);
    expect(hits.sort()).toEqual([...new Set(expected)].sort());
    if (result.structuredContent !== undefined) {
      expect(tools.get(name)?.outputSchema, "structured result without outputSchema").toBeDefined();
    }
  });

  it.each(Object.entries(RECORDS))(
    "create_dns_record sends a %s record the spec accepts",
    async (_type, record) => {
      const { result, violations } = await callAgainstSpec("create_dns_record", recordArgs(record));

      expect(result.isError).not.toBe(true);
      expect(violations).toEqual([]);
    },
  );

  it.each(Object.entries(RECORDS))(
    "update_dns_record sends a %s record the spec accepts",
    async (_type, record) => {
      const { result, violations } = await callAgainstSpec("update_dns_record", {
        ...recordArgs(record),
        record_id: record.id,
      });

      expect(result.isError).not.toBe(true);
      expect(violations).toEqual([]);
    },
  );
});

describe("MCP tools with only the required arguments", () => {
  it.each<[string, Args]>([
    ["create_dns_record", { domain_id: 1, host: "www", type: "A", data: "192.0.2.1" }],
    ["update_dns_record", { domain_id: 1, record_id: 1, host: "@", type: "TXT", data: "x" }],
    ["upsert_dns_record", { domain_id: 1, host: "new", type: "CNAME", data: "example.com" }],
    ["patch_dns_record", { domain_id: 1, record_id: 1 }],
    ["create_forward", { domain_id: 1, host: "www", url: "https://example.com" }],
    ["update_dyndns", { hostname: "www.example.com" }],
    ["list_dns_records", { domain_id: 1 }],
    ["list_invoices", {}],
  ])("%s %j sends requests the spec accepts", async (name, args) => {
    const { result, violations } = await callAgainstSpec(name, args);

    expect(result.isError).not.toBe(true);
    expect(violations).toEqual([]);
  });
});

describe("output schemas accept every response the spec allows", () => {
  it.each<[string, Args, string, unknown]>([
    ["list_domains", {}, "domains", expect.arrayContaining([DOMAIN_FULL])],
    ["get_domain", { domain_id: 1 }, "id", DOMAIN_FULL.id],
    ["list_dns_records", { domain_id: 1 }, "records", Object.values(RECORDS)],
    ["get_dns_record", { domain_id: 1, record_id: 1 }, "data", RECORDS.A.data],
    ["list_forwards", { domain_id: 1 }, "forwards", expect.arrayContaining([FORWARD_FULL])],
    ["get_forward", { domain_id: 1, host: "www" }, "url", FORWARD_FULL.url],
    ["create_dns_record", recordArgs(RECORDS.A), "data", RECORDS.A.data],
    ["patch_dns_record", { domain_id: 1, record_id: 1, ttl: 600 }, "data", RECORDS.A.data],
    ["upsert_dns_record", recordArgs(RECORDS.A), "action", "updated"],
    ["create_forward", { domain_id: 1, ...FORWARD_FULL }, "host", FORWARD_FULL.host],
    ["update_forward", { domain_id: 1, ...FORWARD_FULL }, "url", FORWARD_FULL.url],
    ["list_invoices", {}, "invoices", expect.arrayContaining([INVOICE_FULL, CREDIT_NOTE])],
    ["get_invoice", { invoice_id: 1 }, "status", INVOICE_FULL.status],
  ])("%s", async (name, args, field, expected) => {
    const { result, violations } = await callAgainstSpec(name, args);

    expect(violations).toEqual([]);
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ [field]: expected });
  });
});
