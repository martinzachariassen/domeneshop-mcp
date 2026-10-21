import { describe, expect, it } from "vitest";
import { DomeneshopClient } from "#domeneshop/index.js";
import { createServer } from "#mcp/server.js";
import { connect, listToolsByName } from "#testing/mcpHarness.js";
import type { Handler } from "#testing/testServer.js";

const ok: Handler = (_req, res) => {
  res.writeHead(200);
  res.end();
};

describe("tool filtering", () => {
  it("exposes only read-only tools in read-only mode", async () => {
    const harness = await connect(ok, { readOnly: true });
    try {
      const tools = await listToolsByName(harness.client);
      expect(tools.size).toBe(8);
      for (const tool of tools.values()) {
        expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      }
      expect(harness.client.getInstructions()).toContain("read-only mode");
    } finally {
      await harness.close();
    }
  });

  it("rejects calls to a hidden write tool without reaching the API", async () => {
    const harness = await connect(ok, { readOnly: true });
    try {
      let failed = false;
      try {
        const result = await harness.client.callTool({
          name: "delete_dns_record",
          arguments: { domain_id: 1, record_id: 1 },
        });
        failed = result.isError === true;
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
      expect(harness.apiServer.requests).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  it("registers only allowlisted tools", async () => {
    const harness = await connect(ok, { tools: new Set(["list_domains", "patch_dns_record"]) });
    try {
      const tools = await listToolsByName(harness.client);
      expect([...tools.keys()].sort()).toEqual(["list_domains", "patch_dns_record"]);
    } finally {
      await harness.close();
    }
  });

  it("hides denylisted tools and combines with read-only mode", async () => {
    const harness = await connect(ok, {
      readOnly: true,
      disabledTools: new Set(["list_invoices", "get_invoice"]),
    });
    try {
      const tools = await listToolsByName(harness.client);
      expect(tools.size).toBe(6);
      expect(tools.has("list_invoices")).toBe(false);
    } finally {
      await harness.close();
    }
  });

  it("warns when read-only mode hides an allowlisted write tool", () => {
    const warnings: string[] = [];
    createServer(new DomeneshopClient("token", "secret"), {
      readOnly: true,
      tools: new Set(["list_domains", "patch_dns_record"]),
      onWarning: (message) => warnings.push(message),
    });
    expect(warnings).toEqual([
      "patch_dns_record is listed in DOMENESHOP_TOOLS but is not exposed: read-only mode hides tools that change the account.",
    ]);
  });

  it("warns when the filters leave no tools at all", () => {
    const warnings: string[] = [];
    createServer(new DomeneshopClient("token", "secret"), {
      tools: new Set(["list_domains"]),
      disabledTools: new Set(["list_domains"]),
      onWarning: (message) => warnings.push(message),
    });
    expect(warnings).toEqual([
      "list_domains is listed in DOMENESHOP_TOOLS but is not exposed: DOMENESHOP_DISABLED_TOOLS also lists it.",
      "no tools are exposed; check DOMENESHOP_READ_ONLY, DOMENESHOP_TOOLS and DOMENESHOP_DISABLED_TOOLS.",
    ]);
  });

  it("does not warn for an ordinary configuration", () => {
    const warnings: string[] = [];
    createServer(new DomeneshopClient("token", "secret"), {
      readOnly: true,
      onWarning: (message) => warnings.push(message),
    });
    expect(warnings).toEqual([]);
  });

  it("fails fast on a misspelled tool name", () => {
    const client = new DomeneshopClient("token", "secret");
    expect(() => createServer(client, { tools: new Set(["list_domain"]) })).toThrow(
      "DOMENESHOP_TOOLS names unknown tool(s): list_domain",
    );
    expect(() => createServer(client, { disabledTools: new Set(["nope"]) })).toThrow(
      "DOMENESHOP_DISABLED_TOOLS names unknown tool(s): nope",
    );
  });
});
