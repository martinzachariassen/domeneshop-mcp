import { isIP } from "node:net";
import type { DNSRecord } from "../domeneshop/index.js";

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
