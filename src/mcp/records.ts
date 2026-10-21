import type { DNSRecord } from "../domeneshop/index.js";

/** Fields the Domeneshop API requires per record type, beyond host, type and data. */
const REQUIRED_FIELDS: Partial<Record<string, readonly (keyof DNSRecord)[]>> = {
  MX: ["priority"],
  SRV: ["priority", "weight", "port"],
  TLSA: ["usage", "selector", "dtype"],
  DS: ["tag", "alg", "digest"],
  CAA: ["flags", "tag"],
};

/**
 * Throws before the request is sent when a type-specific field is missing,
 * so the model gets an actionable message instead of a bare API 400.
 */
export function validateRecord(record: DNSRecord): void {
  const required = REQUIRED_FIELDS[record.type.toUpperCase()] ?? [];
  const missing = required.filter((field) => record[field] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `${record.type} records require ${required.join(", ")}; missing: ${missing.join(", ")}`,
    );
  }
}
