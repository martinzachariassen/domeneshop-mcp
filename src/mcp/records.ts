import { isIP } from "node:net";
import type { DNSRecord } from "../domeneshop/index.js";

/** Every writable DNS record field; `id` is read-only. */
export const RECORD_FIELDS = [
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
] as const satisfies readonly (keyof DNSRecord)[];

type RecordFields = { [K in (typeof RECORD_FIELDS)[number]]?: DNSRecord[K] | undefined };

/** Copies the writable record fields that are set, e.g. out of tool arguments. */
export function pickRecord(
  source: Pick<DNSRecord, "host" | "type" | "data"> & RecordFields,
): DNSRecord {
  return mergeRecord({ host: source.host, type: source.type, data: source.data }, source);
}

/**
 * Overlays the fields set in `patch` onto `existing`. Fields the patch leaves
 * undefined keep their stored value; the read-only `id` is not sent back.
 */
export function mergeRecord(existing: DNSRecord, patch: RecordFields): DNSRecord {
  const merged: DNSRecord = { host: existing.host, type: existing.type, data: existing.data };
  for (const field of RECORD_FIELDS) {
    const value = patch[field] !== undefined ? patch[field] : existing[field];
    if (value !== undefined) {
      Object.assign(merged, { [field]: value });
    }
  }
  return merged;
}

const REQUIRED_FIELDS: Partial<Record<string, readonly (keyof DNSRecord)[]>> = {
  MX: ["priority"],
  SRV: ["priority", "weight", "port"],
  TLSA: ["usage", "selector", "dtype"],
  DS: ["tag", "alg", "digest"],
  CAA: ["flags", "tag"],
};

/**
 * Checks rules that span several fields before the request is sent, so the
 * model gets an actionable message instead of a bare API 400.
 */
export function validateRecord(record: DNSRecord): void {
  const type = record.type.toUpperCase();
  const required = REQUIRED_FIELDS[type] ?? [];
  const missing = required.filter((field) => record[field] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `${record.type} records require ${required.join(", ")}; missing: ${missing.join(", ")}`,
    );
  }

  if (type === "A" && isIP(record.data) !== 4) {
    throw new Error(`A records need an IPv4 address as data, got "${record.data}"`);
  }
  if (type === "AAAA" && isIP(record.data) !== 6) {
    throw new Error(`AAAA records need an IPv6 address as data, got "${record.data}"`);
  }
  if (type === "DS" && typeof record.tag !== "number") {
    throw new Error("DS records need tag as a number: the key tag of the referenced DNSKEY");
  }
  if (type === "CAA" && typeof record.tag !== "string") {
    throw new Error("CAA records need tag as a string, e.g. issue, issuewild or iodef");
  }
}
