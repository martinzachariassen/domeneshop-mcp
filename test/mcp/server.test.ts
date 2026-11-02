import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { INVOICE_STATUSES, RECORD_TYPES } from "#domeneshop/index.js";
import { listToolsByName, resultText, schemaProperties, withHarness } from "#testing/mcpHarness.js";
import { sendJson } from "#testing/testServer.js";

const ALL_TOOLS = [
  "list_domains",
  "get_domain",
  "list_dns_records",
  "get_dns_record",
  "create_dns_record",
  "update_dns_record",
  "patch_dns_record",
  "upsert_dns_record",
  "delete_dns_record",
  "list_forwards",
  "get_forward",
  "create_forward",
  "update_forward",
  "delete_forward",
  "list_invoices",
  "get_invoice",
  "update_dyndns",
];

function requireTool(tools: Map<string, Tool>, name: string): Tool {
  const tool = tools.get(name);
  if (!tool) {
    throw new Error(`tool ${name} is not registered`);
  }
  return tool;
}

describe("createServer", () => {
  it("registers one tool per Domeneshop API operation, plus the DNS helpers", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(200);
        res.end();
      },
      async (harness) => {
        const tools = await listToolsByName(harness.client);
        expect([...tools.keys()].sort()).toEqual([...ALL_TOOLS].sort());
      },
    );
  });

  it("annotates every tool, matching its read/write behaviour", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(200);
        res.end();
      },
      async (harness) => {
        const tools = await listToolsByName(harness.client);

        const readOnlyTools = [
          "list_domains",
          "get_domain",
          "list_dns_records",
          "get_dns_record",
          "list_forwards",
          "get_forward",
          "list_invoices",
          "get_invoice",
        ];
        const destructiveTools = [
          "update_dns_record",
          "patch_dns_record",
          "upsert_dns_record",
          "delete_dns_record",
          "update_forward",
          "delete_forward",
          "update_dyndns",
        ];
        const additiveTools = ["create_dns_record", "create_forward"];

        for (const name of ALL_TOOLS) {
          expect(requireTool(tools, name).annotations, name).toBeDefined();
        }
        for (const name of readOnlyTools) {
          expect(requireTool(tools, name).annotations?.readOnlyHint, name).toBe(true);
        }
        for (const name of destructiveTools) {
          const annotations = requireTool(tools, name).annotations;
          expect(annotations?.readOnlyHint, name).not.toBe(true);
          expect(annotations?.destructiveHint, name).toBe(true);
        }
        for (const name of additiveTools) {
          const annotations = requireTool(tools, name).annotations;
          expect(annotations?.readOnlyHint, name).not.toBe(true);
          expect(annotations?.destructiveHint, name).toBe(false);
        }
      },
    );
  });

  it("exposes every type-specific field on the DNS write tools", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(200);
        res.end();
      },
      async (harness) => {
        const tools = await listToolsByName(harness.client);
        const wantFields = [
          "domain_id",
          "host",
          "type",
          "data",
          "ttl",
          "priority",
          "weight",
          "port",
          "usage",
          "selector",
          "dtype",
          "alg",
          "digest",
          "flags",
          "tag",
        ];

        for (const name of ["create_dns_record", "update_dns_record"]) {
          const props = schemaProperties(requireTool(tools, name));
          for (const field of wantFields) {
            expect(props, `${name}.${field}`).toHaveProperty(field);
          }
        }

        const updateProps = schemaProperties(requireTool(tools, "update_dns_record"));
        expect(updateProps).toHaveProperty("record_id");
      },
    );
  });

  it("constrains the DNS record type to the supported enum on write tools", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(200);
        res.end();
      },
      async (harness) => {
        const tools = await listToolsByName(harness.client);
        for (const name of ["create_dns_record", "update_dns_record"]) {
          const props = schemaProperties(requireTool(tools, name));
          expect(props["type"]?.enum, name).toEqual(RECORD_TYPES);
        }
      },
    );
  });

  it("constrains optional filters to their enum while still accepting an empty string", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(200);
        res.end("[]");
      },
      async (harness) => {
        const tools = await listToolsByName(harness.client);

        const listDnsType = JSON.stringify(
          schemaProperties(requireTool(tools, "list_dns_records"))["type"],
        );
        for (const type of RECORD_TYPES) {
          expect(listDnsType).toContain(`"${type}"`);
        }

        const listInvoicesStatus = JSON.stringify(
          schemaProperties(requireTool(tools, "list_invoices"))["status"],
        );
        for (const status of INVOICE_STATUSES) {
          expect(listInvoicesStatus).toContain(`"${status}"`);
        }

        const empty = await harness.client.callTool({
          name: "list_invoices",
          arguments: { status: "" },
        });
        expect(empty.isError).not.toBe(true);
        expect(harness.apiServer.requests[0]?.url).toBe("/invoices");

        const invalid = await harness.client.callTool({
          name: "list_invoices",
          arguments: { status: "overdue" },
        });
        expect(invalid.isError).toBe(true);
      },
    );
  });

  it("gives every tool a title and marks it as reaching an external system", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(200);
        res.end();
      },
      async (harness) => {
        const tools = await listToolsByName(harness.client);
        for (const name of ALL_TOOLS) {
          const tool = requireTool(tools, name);
          expect(tool.title, name).toMatch(/^[A-Z]/);
          expect(tool.annotations?.title, name).toBe(tool.title);
          expect(tool.annotations?.openWorldHint, name).toBe(true);
        }
      },
    );
  });

  it("declares an output schema on every read-only tool", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(200);
        res.end();
      },
      async (harness) => {
        const tools = await listToolsByName(harness.client);
        for (const tool of tools.values()) {
          if (tool.annotations?.readOnlyHint) {
            expect(tool.outputSchema, tool.name).toBeDefined();
          }
        }
      },
    );
  });

  it("sends server instructions and identity on initialize", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(200);
        res.end();
      },
      async (harness) => {
        expect(harness.client.getInstructions()).toContain("list_domains");
        expect(harness.client.getServerVersion()).toMatchObject({
          name: "domeneshop-mcp",
          title: "Domeneshop",
        });
      },
    );
  });
});

describe("tool calls end-to-end", () => {
  it("creates a CAA DNS record, surviving tool arguments, client and HTTP body", async () => {
    let received: Record<string, unknown> = {};
    await withHarness(
      (req, res, body) => {
        if (req.method === "GET") {
          sendJson(res, 200, { id: 99, ttl: 3600, ...received });
          return;
        }
        received = JSON.parse(body) as Record<string, unknown>;
        sendJson(res, 201, { id: 99 });
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "create_dns_record",
          arguments: {
            domain_id: 42,
            host: "@",
            type: "CAA",
            data: "letsencrypt.org",
            flags: 0,
            tag: "issue",
          },
        });

        expect(result.isError).not.toBe(true);
        expect(received["type"]).toBe("CAA");
        expect(received["tag"]).toBe("issue");
        expect(received["flags"]).toBe(0);
        expect(harness.apiServer.requests[1]?.url).toBe("/domains/42/dns/99");
        expect(result.structuredContent).toMatchObject({ id: 99, type: "CAA", ttl: 3600 });
      },
    );
  });

  it("reports the created forward, not an empty object", async () => {
    await withHarness(
      (_req, res) => {
        res.writeHead(201, { Location: "/domains/42/forwards/www" });
        res.end();
      },
      async (harness) => {
        const result = await harness.client.callTool({
          name: "create_forward",
          arguments: { domain_id: 42, host: "www", url: "https://example.com" },
        });

        expect(result.isError).not.toBe(true);
        const text = resultText(result);
        expect(text).toContain("www");
        expect(text).toContain("https://example.com");
      },
    );
  });

  it("surfaces a Domeneshop API failure as a tool error, not a protocol error", async () => {
    await withHarness(
      (_req, res) => {
        sendJson(res, 401, { code: "authentication:failed" });
      },
      async (harness) => {
        const result = await harness.client.callTool({ name: "list_domains", arguments: {} });

        expect(result.isError).toBe(true);
        expect(resultText(result)).toContain("401");
      },
    );
  });
});
