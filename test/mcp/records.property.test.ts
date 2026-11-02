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

const casings = (type: string): fc.Arbitrary<string> =>
  fc.constantFrom(type, type.toLowerCase(), type[0] + type.slice(1).toLowerCase());

const maybe = <T>(arb: fc.Arbitrary<T>): fc.Arbitrary<T | undefined> =>
  fc.option(arb, { nil: undefined });

const optionalFields = {
  host: fc.string(),
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
};

const record: fc.Arbitrary<DNSRecord> = fc.oneof(
  fc.record({
    ...optionalFields,
    type: casings("A"),
    data: fc.ipV4(),
    tag: fc.constant(undefined),
  }),
  fc.record({
    ...optionalFields,
    type: casings("AAAA"),
    data: fc.ipV6(),
    tag: fc.constant(undefined),
  }),
  fc.record({ ...optionalFields, type: casings("DS"), data: fc.string(), tag: maybe(fc.nat()) }),
  fc.record({
    ...optionalFields,
    type: casings("CAA"),
    data: fc.string(),
    tag: maybe(fc.constantFrom("issue", "issuewild", "iodef")),
  }),
  fc.record({
    ...optionalFields,
    type: fc.constantFrom("CNAME", "TXT", "NS", "MX", "SRV", "TLSA").chain(casings),
    data: fc.string(),
    tag: fc.constant(undefined),
  }),
);

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

  it("rejects A data that is not IPv4 and AAAA data that is not IPv6", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({ type: casings("A"), data: fc.oneof(fc.ipV6(), fc.domain()) }),
          fc.record({ type: casings("AAAA"), data: fc.oneof(fc.ipV4(), fc.domain()) }),
        ),
        ({ type, data }) => {
          expect(() => validateRecord({ host: "@", type, data })).toThrow("address as data");
        },
      ),
    );
  });

  it("requires a numeric DS tag and a string CAA tag", () => {
    const ds = { host: "@", type: "DS", data: "ab", alg: 13, digest: 2 };
    const caa = { host: "@", type: "CAA", data: "letsencrypt.org", flags: 0 };
    expect(() => validateRecord({ ...ds, tag: "12345" })).toThrow(
      "DS records need tag as a number",
    );
    expect(() => validateRecord({ ...caa, tag: 0 })).toThrow("CAA records need tag as a string");
  });
});
