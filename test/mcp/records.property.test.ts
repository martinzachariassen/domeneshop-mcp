import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { DNSRecord } from "#domeneshop/index.js";
import { validateRecord } from "#mcp/records.js";

// Written independently of src/mcp/records.ts so the property checks the
// documented contract rather than echoing the implementation.
const REQUIRED: Record<string, readonly (keyof DNSRecord)[]> = {
  MX: ["priority"],
  SRV: ["priority", "weight", "port"],
  TLSA: ["usage", "selector", "dtype"],
  DS: ["tag", "alg", "digest"],
  CAA: ["flags", "tag"],
};

const recordType = fc
  .constantFrom("A", "AAAA", "CNAME", "TXT", "NS", "MX", "SRV", "TLSA", "DS", "CAA")
  .chain((type) =>
    fc.constantFrom(type, type.toLowerCase(), type[0] + type.slice(1).toLowerCase()),
  );

const maybe = <T>(arb: fc.Arbitrary<T>): fc.Arbitrary<T | undefined> =>
  fc.option(arb, { nil: undefined });

const record: fc.Arbitrary<DNSRecord> = fc.record({
  host: fc.string(),
  type: recordType,
  data: fc.string(),
  ttl: maybe(fc.nat()),
  priority: maybe(fc.nat({ max: 65_535 })),
  weight: maybe(fc.nat({ max: 65_535 })),
  port: maybe(fc.nat({ max: 65_535 })),
  usage: maybe(fc.nat({ max: 3 })),
  selector: maybe(fc.nat({ max: 1 })),
  dtype: maybe(fc.nat({ max: 2 })),
  alg: maybe(fc.nat({ max: 255 })),
  digest: maybe(fc.nat({ max: 4 })),
  flags: maybe(fc.nat({ max: 255 })),
  tag: maybe(fc.oneof(fc.nat({ max: 65_535 }), fc.constantFrom("issue", "issuewild", "iodef"))),
});

describe("validateRecord (property-based)", () => {
  it("throws exactly when a field required for the record type is missing", () => {
    fc.assert(
      fc.property(record, (input) => {
        const required = REQUIRED[input.type.toUpperCase()] ?? [];
        const missing = required.filter((field) => input[field] === undefined);
        if (missing.length === 0) {
          expect(() => validateRecord(input)).not.toThrow();
        } else {
          expect(() => validateRecord(input)).toThrow(`missing: ${missing.join(", ")}`);
        }
      }),
    );
  });
});
