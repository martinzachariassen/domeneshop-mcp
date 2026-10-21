import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DNSRecord, DomeneshopClient } from "../../domeneshop/index.js";
import { RECORD_TYPES } from "../../domeneshop/index.js";
import { additive, destructive, readOnly } from "../annotations.js";
import { dnsRecordOutput, domainIdField, optionalFilter, ttlField } from "../fields.js";
import { validateRecord } from "../records.js";
import { jsonResult, listResult, textResult } from "../result.js";
import type { InferShape } from "../schema.js";
import { toolHandler } from "../tool.js";

const recordIdField = z
  .number()
  .int()
  .positive()
  .describe("the DNS record ID, from list_dns_records");

const listDNSRecordsShape = {
  domain_id: domainIdField,
  host: z
    .string()
    .optional()
    .describe("only return records for this host/subdomain, e.g. 'www' or '@'"),
  type: optionalFilter(RECORD_TYPES).describe("only return records of this type"),
};
type ListDNSRecordsArgs = InferShape<typeof listDNSRecordsShape>;

const getDNSRecordShape = {
  domain_id: domainIdField,
  record_id: recordIdField,
};
type GetDNSRecordArgs = InferShape<typeof getDNSRecordShape>;

const dnsRecordShape = {
  domain_id: domainIdField,
  host: z
    .string()
    .describe("the host/subdomain the record applies to, e.g. 'www' or '@' for the root"),
  type: z.enum(RECORD_TYPES).describe("the record type"),
  data: z
    .string()
    .describe(
      "the record's main value: an IP address for A/AAAA, a hostname for ANAME/CNAME/MX/NS/SRV, free text for TXT, the CAA property value, or the hex hash for DS/TLSA",
    ),
  ttl: ttlField.optional(),
  priority: z
    .number()
    .int()
    .optional()
    .describe("required for MX and SRV: preference value, lower is tried first"),
  weight: z
    .number()
    .int()
    .optional()
    .describe("required for SRV: relative weight among records with the same priority"),
  port: z
    .number()
    .int()
    .min(0)
    .max(65535)
    .optional()
    .describe("required for SRV: the port the service is found on"),
  usage: z
    .number()
    .int()
    .optional()
    .describe("required for TLSA: certificate usage (0 PKIX-TA, 1 PKIX-EE, 2 DANE-TA, 3 DANE-EE)"),
  selector: z
    .number()
    .int()
    .optional()
    .describe(
      "required for TLSA: what the hash is taken from (0 full certificate, 1 subject public key)",
    ),
  dtype: z
    .number()
    .int()
    .optional()
    .describe(
      "required for TLSA: matching type of the hash in data (0 exact match, 1 SHA-256, 2 SHA-512)",
    ),
  alg: z.number().int().optional().describe("required for DS: the DNSSEC signing algorithm number"),
  digest: z
    .number()
    .int()
    .optional()
    .describe("required for DS: digest type of the hash in data (1 SHA-1, 2 SHA-256, 4 SHA-384)"),
  flags: z
    .number()
    .int()
    .optional()
    .describe("required for CAA: 128 to mark the property critical, otherwise 0"),
  tag: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      "required for DS (the key tag of the referenced DNSKEY) and for CAA (the property tag, e.g. issue, issuewild or iodef)",
    ),
};
type DNSRecordArgs = InferShape<typeof dnsRecordShape>;

const updateDNSRecordShape = {
  ...dnsRecordShape,
  record_id: recordIdField.describe("the DNS record ID to update, from list_dns_records"),
};
type UpdateDNSRecordArgs = InferShape<typeof updateDNSRecordShape>;

const deleteDNSRecordShape = {
  domain_id: domainIdField,
  record_id: recordIdField.describe("the DNS record ID to delete, from list_dns_records"),
};
type DeleteDNSRecordArgs = InferShape<typeof deleteDNSRecordShape>;

function toDNSRecord(args: DNSRecordArgs): DNSRecord {
  return {
    host: args.host,
    type: args.type,
    data: args.data,
    ttl: args.ttl,
    priority: args.priority,
    weight: args.weight,
    port: args.port,
    usage: args.usage,
    selector: args.selector,
    dtype: args.dtype,
    alg: args.alg,
    digest: args.digest,
    flags: args.flags,
    tag: args.tag,
  };
}

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

export function registerDNSTools(server: McpServer, client: DomeneshopClient): void {
  server.registerTool(
    "list_dns_records",
    {
      description: "List DNS records for a domain, optionally filtered by host and/or record type.",
      inputSchema: listDNSRecordsShape,
      outputSchema: { records: z.array(dnsRecordOutput) },
      ...readOnly("List DNS records"),
    },
    toolHandler<ListDNSRecordsArgs>(async ({ domain_id, host, type }, { signal }) => {
      const records = await client.dns.list(domain_id, { host, type }, { signal });
      return listResult("records", records);
    }),
  );

  server.registerTool(
    "get_dns_record",
    {
      description: "Get a single DNS record by ID.",
      inputSchema: getDNSRecordShape,
      outputSchema: dnsRecordOutput,
      ...readOnly("Get DNS record"),
    },
    toolHandler<GetDNSRecordArgs>(async ({ domain_id, record_id }, { signal }) => {
      const record = await client.dns.get(domain_id, record_id, { signal });
      return jsonResult(record);
    }),
  );

  server.registerTool(
    "create_dns_record",
    {
      description:
        "Create a new DNS record for a domain. Returns the stored record, including its new ID.",
      inputSchema: dnsRecordShape,
      ...additive("Create DNS record"),
    },
    toolHandler<DNSRecordArgs>(async (args, { signal }) => {
      const record = toDNSRecord(args);
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
        "Read the record with get_dns_record first if you are changing only part of it. " +
        "Returns the stored record.",
      inputSchema: updateDNSRecordShape,
      ...destructive("Replace DNS record"),
    },
    toolHandler<UpdateDNSRecordArgs>(async (args, { signal }) => {
      const record = toDNSRecord(args);
      validateRecord(record);
      await client.dns.update(args.domain_id, args.record_id, record, { signal });
      return jsonResult(await readBack(client, args.domain_id, args.record_id, record, signal));
    }),
  );

  server.registerTool(
    "delete_dns_record",
    {
      description: "Delete a DNS record. This cannot be undone.",
      inputSchema: deleteDNSRecordShape,
      ...destructive("Delete DNS record"),
    },
    toolHandler<DeleteDNSRecordArgs>(async ({ domain_id, record_id }, { signal }) => {
      await client.dns.delete(domain_id, record_id, { signal });
      return textResult(
        `DNS record ${String(record_id)} deleted from domain ${String(domain_id)}.`,
      );
    }),
  );
}
