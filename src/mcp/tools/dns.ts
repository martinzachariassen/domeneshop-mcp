import { z } from "zod";
import type { DNSRecord, DomeneshopClient } from "../../domeneshop/index.js";
import { RECORD_TYPES } from "../../domeneshop/index.js";
import { additive, destructive, readOnly } from "../annotations.js";
import {
  domainIdField,
  hostField,
  optionalFilter,
  recordIdField,
  ttlField,
  uintField,
} from "../fields.js";
import { dnsRecordOutput } from "../outputs.js";
import { mergeRecord, pickRecord, validateRecord } from "../records.js";
import type { ToolRegistrar } from "../registry.js";
import { jsonResult, listResult, textResult } from "../result.js";
import { toolHandler } from "../tool.js";

const recordFieldsShape = {
  host: hostField("the host/subdomain the record applies to, e.g. 'www' or '@' for the root"),
  type: z.enum(RECORD_TYPES).describe("the record type"),
  data: z
    .string()
    .min(1)
    .describe(
      "the record's main value: an IPv4 address for A, an IPv6 address for AAAA, a hostname for ANAME/CNAME/MX/NS/SRV, free text for TXT, the CAA property value, or the hex hash for DS/TLSA",
    ),
  ttl: ttlField.optional(),
  priority: uintField(65535)
    .optional()
    .describe("required for MX and SRV: preference value 0-65535, lower is tried first"),
  weight: uintField(65535)
    .optional()
    .describe("required for SRV: relative weight 0-65535 among records with the same priority"),
  port: uintField(65535)
    .optional()
    .describe("required for SRV: the port 0-65535 the service is found on"),
  usage: uintField(3)
    .optional()
    .describe("required for TLSA: certificate usage (0 PKIX-TA, 1 PKIX-EE, 2 DANE-TA, 3 DANE-EE)"),
  selector: uintField(1)
    .optional()
    .describe(
      "required for TLSA: what the hash is taken from (0 full certificate, 1 subject public key)",
    ),
  dtype: uintField(2)
    .optional()
    .describe(
      "required for TLSA: matching type of the hash in data (0 exact match, 1 SHA-256, 2 SHA-512)",
    ),
  alg: uintField(255)
    .optional()
    .describe("required for DS: the DNSSEC signing algorithm number, 0-255"),
  digest: uintField(255)
    .optional()
    .describe("required for DS: digest type of the hash in data (1 SHA-1, 2 SHA-256, 4 SHA-384)"),
  flags: uintField(255)
    .optional()
    .describe("required for CAA: 128 to mark the property critical, otherwise 0"),
  tag: z
    .union([uintField(65535), z.string().trim().min(1)])
    .optional()
    .describe(
      "required for DS as a number (the key tag 0-65535 of the referenced DNSKEY) and for CAA as a string (the property tag, e.g. issue, issuewild or iodef)",
    ),
};

const recordInput = z.object({ domain_id: domainIdField, ...recordFieldsShape });

/**
 * Reads the record back after a write so the model sees what the API
 * actually stored (defaults included). The write already succeeded, so a
 * failed read falls back to what was sent instead of reporting an error.
 */
async function readBack(
  client: DomeneshopClient,
  domainId: number,
  recordId: number,
  sent: DNSRecord,
  signal: AbortSignal,
): Promise<DNSRecord> {
  try {
    return await client.dns.get(domainId, recordId, { signal });
  } catch {
    return { ...sent, id: recordId };
  }
}

/** Filters again after the API's host/type filter, in case that filter is looser than an exact match. */
async function findRecords(
  client: DomeneshopClient,
  domainId: number,
  host: string,
  type: string,
  signal: AbortSignal,
): Promise<DNSRecord[]> {
  const records = await client.dns.list(domainId, { host, type }, { signal });
  return records.filter(
    (record) =>
      record.host.toLowerCase() === host.toLowerCase() && record.type.toUpperCase() === type,
  );
}

export function registerDNSTools(server: ToolRegistrar, client: DomeneshopClient): void {
  server.registerTool(
    "list_dns_records",
    {
      description: "List DNS records for a domain, optionally filtered by host and/or record type.",
      inputSchema: z.object({
        domain_id: domainIdField,
        host: z
          .string()
          .trim()
          .optional()
          .describe("only return records for this host/subdomain, e.g. 'www' or '@'"),
        type: optionalFilter(RECORD_TYPES).describe("only return records of this type"),
      }),
      outputSchema: z.object({ records: z.array(dnsRecordOutput) }),
      ...readOnly("List DNS records"),
    },
    toolHandler(async ({ domain_id, host, type }, { signal }) => {
      const records = await client.dns.list(domain_id, { host, type }, { signal });
      return listResult("records", records);
    }),
  );

  server.registerTool(
    "get_dns_record",
    {
      description: "Get a single DNS record by ID.",
      inputSchema: z.object({ domain_id: domainIdField, record_id: recordIdField }),
      outputSchema: dnsRecordOutput,
      ...readOnly("Get DNS record"),
    },
    toolHandler(async ({ domain_id, record_id }, { signal }) => {
      const record = await client.dns.get(domain_id, record_id, { signal });
      return jsonResult(record);
    }),
  );

  server.registerTool(
    "create_dns_record",
    {
      description:
        "Create a new DNS record for a domain. Returns the stored record, including its new ID.",
      inputSchema: recordInput,
      outputSchema: dnsRecordOutput,
      ...additive("Create DNS record"),
    },
    toolHandler(async (args, { signal }) => {
      const record = pickRecord(args);
      validateRecord(record);
      const id = await client.dns.create(args.domain_id, record, { signal });
      return jsonResult(await readBack(client, args.domain_id, id, record, signal));
    }),
  );

  server.registerTool(
    "update_dns_record",
    {
      description:
        "Replace an existing DNS record. This overwrites the whole record, " +
        "so send every field it should keep: any omitted field is dropped, and " +
        "leaving out ttl resets it to the default 3600 seconds. " +
        "To change only some fields, use patch_dns_record instead. " +
        "Returns the stored record.",
      inputSchema: recordInput.extend({
        record_id: recordIdField.describe("the DNS record ID to update, from list_dns_records"),
      }),
      outputSchema: dnsRecordOutput,
      ...destructive("Replace DNS record"),
    },
    toolHandler(async (args, { signal }) => {
      const record = pickRecord(args);
      validateRecord(record);
      await client.dns.update(args.domain_id, args.record_id, record, { signal });
      return jsonResult(await readBack(client, args.domain_id, args.record_id, record, signal));
    }),
  );

  server.registerTool(
    "patch_dns_record",
    {
      description:
        "Change only some fields of an existing DNS record, e.g. just data or ttl. " +
        "The current record is read first and every field you leave out keeps its stored value; " +
        "when you change the type, give the new type's required fields too. " +
        "Prefer this over update_dns_record. Returns the stored record.",
      inputSchema: z.object({
        domain_id: domainIdField,
        record_id: recordIdField.describe("the DNS record ID to change, from list_dns_records"),
        ...z.object(recordFieldsShape).partial().shape,
      }),
      outputSchema: dnsRecordOutput,
      ...destructive("Patch DNS record"),
    },
    toolHandler(async (args, { signal }) => {
      const existing = await client.dns.get(args.domain_id, args.record_id, { signal });
      const record = mergeRecord(existing, args);
      validateRecord(record);
      await client.dns.update(args.domain_id, args.record_id, record, { signal });
      return jsonResult(await readBack(client, args.domain_id, args.record_id, record, signal));
    }),
  );

  server.registerTool(
    "upsert_dns_record",
    {
      description:
        "Make sure a host has exactly this record of the given type: updates the existing record for that host and type, or creates one if there is none. " +
        "When updating, optional fields you leave out (e.g. ttl, priority) keep their stored value. " +
        "Fails without changing anything if the host already has several records of that type (common for MX and TXT); " +
        "then use patch_dns_record with a record_id, or create_dns_record to add another. " +
        'Returns { action: "created" | "updated", record }.',
      inputSchema: recordInput,
      outputSchema: z.object({ action: z.enum(["created", "updated"]), record: dnsRecordOutput }),
      ...destructive("Create or update DNS record"),
    },
    toolHandler(async (args, { signal }) => {
      const record = pickRecord(args);
      const matches = await findRecords(client, args.domain_id, args.host, args.type, signal);

      if (matches.length > 1) {
        const ids = matches.map((r) => String(r.id)).join(", ");
        throw new Error(
          `${args.host} has ${String(matches.length)} ${args.type} records (IDs ${ids}), so it is ambiguous which to update. ` +
            "Use patch_dns_record with one of these record_id values, or create_dns_record to add another.",
        );
      }

      const existing = matches[0];
      if (existing?.id !== undefined) {
        const merged = mergeRecord(existing, record);
        validateRecord(merged);
        await client.dns.update(args.domain_id, existing.id, merged, { signal });
        const stored = await readBack(client, args.domain_id, existing.id, merged, signal);
        return jsonResult({ action: "updated", record: stored });
      }

      validateRecord(record);
      const id = await client.dns.create(args.domain_id, record, { signal });
      const stored = await readBack(client, args.domain_id, id, record, signal);
      return jsonResult({ action: "created", record: stored });
    }),
  );

  server.registerTool(
    "delete_dns_record",
    {
      description: "Delete a DNS record. This cannot be undone.",
      inputSchema: z.object({
        domain_id: domainIdField,
        record_id: recordIdField.describe("the DNS record ID to delete, from list_dns_records"),
      }),
      ...destructive("Delete DNS record"),
    },
    toolHandler(async ({ domain_id, record_id }, { signal }) => {
      await client.dns.delete(domain_id, record_id, { signal });
      return textResult(
        `DNS record ${String(record_id)} deleted from domain ${String(domain_id)}.`,
      );
    }),
  );
}
