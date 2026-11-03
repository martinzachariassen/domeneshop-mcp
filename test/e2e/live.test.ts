import { randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DomeneshopClient } from "#domeneshop/index.js";
import { createServer } from "#mcp/server.js";
import { resultText } from "#testing/mcpHarness.js";
import { validateResponse } from "../contract/openapi.js";

const token = process.env["DOMENESHOP_E2E_TOKEN"];
const secret = process.env["DOMENESHOP_E2E_SECRET"];
const domainId = Number(process.env["DOMENESHOP_E2E_DOMAIN_ID"]);
const enabled = Boolean(token && secret && Number.isInteger(domainId) && domainId > 0);

const suffix = randomBytes(4).toString("hex");
const recordHost = `_mcp-e2e-${suffix}`;
// No hyphen: the live API cannot update or delete a forward whose host has one.
const forwardHost = `mcpe2e${suffix}`;

describe.skipIf(!enabled)("live Domeneshop API", () => {
  const api = new DomeneshopClient(token ?? "", secret ?? "");
  const mcp = new Client({ name: "e2e", version: "1.0.0" });
  let recordId: number | undefined;
  let forwardCreated = false;

  async function call(name: string, args: Record<string, unknown>) {
    const result = await mcp.callTool({ name, arguments: args });
    expect(result.isError, resultText(result)).not.toBe(true);
    return result;
  }

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createServer(api).connect(serverTransport);
    await mcp.connect(clientTransport);
  });

  afterAll(async () => {
    const leftovers: string[] = [];
    if (recordId !== undefined) {
      const id = recordId;
      await api.dns.delete(domainId, id).catch((error: unknown) => {
        leftovers.push(`DNS record ${String(id)} (${recordHost}): ${String(error)}`);
      });
    }
    if (forwardCreated) {
      await api.forwards.delete(domainId, forwardHost).catch((error: unknown) => {
        leftovers.push(`forward ${forwardHost}: ${String(error)}`);
      });
    }
    await mcp.close();
    if (leftovers.length > 0) {
      console.warn(
        `E2E cleanup failed; remove these from domain ${String(domainId)} by hand:\n${leftovers.join("\n")}`,
      );
    }
  });

  describe("responses match the spec", () => {
    it("GET /domains and /domains/{domainId}", async () => {
      expect(validateResponse("GET /domains", 200, await api.domains.list())).toEqual([]);
      const domain = await api.domains.get(domainId);
      expect(validateResponse("GET /domains/{domainId}", 200, domain)).toEqual([]);
    });

    it("GET /domains/{domainId}/dns", async () => {
      const records = await api.dns.list(domainId);
      expect(validateResponse("GET /domains/{domainId}/dns", 200, records)).toEqual([]);
    });

    it("GET /domains/{domainId}/forwards/", async () => {
      const forwards = await api.forwards.list(domainId);
      expect(validateResponse("GET /domains/{domainId}/forwards/", 200, forwards)).toEqual([]);
    });

    it("GET /invoices and /invoices/{invoiceId}", async () => {
      const invoices = await api.invoices.list();
      expect(validateResponse("GET /invoices", 200, invoices)).toEqual([]);
      const first = invoices[0];
      if (first) {
        const invoice = await api.invoices.get(first.id);
        expect(validateResponse("GET /invoices/{invoiceId}", 200, invoice)).toEqual([]);
      }
    });
  });

  describe("read-only tools", () => {
    it.each<[string, Record<string, unknown>]>([
      ["list_domains", {}],
      ["get_domain", { domain_id: domainId }],
      ["list_dns_records", { domain_id: domainId }],
      ["list_forwards", { domain_id: domainId }],
      ["list_invoices", {}],
    ])("%s succeeds and matches its output schema", async (name, args) => {
      const result = await call(name, args);
      expect(result.structuredContent).toBeDefined();
    });
  });

  describe("TXT record lifecycle", () => {
    it("creates, reads, patches, upserts and deletes a record", async () => {
      const created = await call("create_dns_record", {
        domain_id: domainId,
        host: recordHost,
        type: "TXT",
        data: "created by domeneshop-mcp e2e",
      });
      const stored = created.structuredContent as { id: number; ttl: number };
      recordId = stored.id;
      expect(stored.ttl).toBe(3600);

      const fetched = await api.dns.get(domainId, recordId);
      expect(validateResponse("GET /domains/{domainId}/dns/{recordId}", 200, fetched)).toEqual([]);

      const patched = await call("patch_dns_record", {
        domain_id: domainId,
        record_id: recordId,
        ttl: 600,
      });
      expect(patched.structuredContent).toMatchObject({ ttl: 600, data: fetched.data });

      const upserted = await call("upsert_dns_record", {
        domain_id: domainId,
        host: recordHost,
        type: "TXT",
        data: "updated by domeneshop-mcp e2e",
      });
      expect(upserted.structuredContent).toMatchObject({
        action: "updated",
        record: { id: recordId, ttl: 600, data: "updated by domeneshop-mcp e2e" },
      });

      await call("delete_dns_record", { domain_id: domainId, record_id: recordId });
      const gone = await mcp.callTool({
        name: "get_dns_record",
        arguments: { domain_id: domainId, record_id: recordId },
      });
      expect(gone.isError).toBe(true);
      expect(resultText(gone)).toContain("404");
      recordId = undefined;
    });
  });

  describe("HTTP forward lifecycle", () => {
    it("creates, reads, updates (keeping frame) and deletes a forward", async () => {
      const created = await call("create_forward", {
        domain_id: domainId,
        host: forwardHost,
        url: "https://example.com/",
        frame: true,
      });
      forwardCreated = true;
      expect(created.structuredContent).toMatchObject({ host: forwardHost });

      const fetched = await api.forwards.get(domainId, forwardHost);
      expect(validateResponse("GET /domains/{domainId}/forwards/{host}", 200, fetched)).toEqual([]);

      const updated = await call("update_forward", {
        domain_id: domainId,
        host: forwardHost,
        url: "https://example.org/",
      });
      expect(updated.structuredContent).toMatchObject({ url: "https://example.org/", frame: true });

      await call("delete_forward", { domain_id: domainId, host: forwardHost });
      forwardCreated = false;
      await expect(api.forwards.get(domainId, forwardHost)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
