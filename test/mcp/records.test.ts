import { describe, expect, it } from "vitest";
import { mergeRecord, pickRecord } from "#mcp/records.js";

describe("mergeRecord", () => {
  it("keeps stored fields the patch leaves undefined and drops the id", () => {
    const merged = mergeRecord(
      { id: 7, host: "@", type: "MX", data: "mx1.example.com", ttl: 300, priority: 10 },
      { data: "mx2.example.com", ttl: undefined },
    );
    expect(merged).toEqual({
      host: "@",
      type: "MX",
      data: "mx2.example.com",
      ttl: 300,
      priority: 10,
    });
  });

  it("drops stored type-specific fields when the patch changes the type", () => {
    const merged = mergeRecord(
      { id: 7, host: "mail", type: "MX", data: "mx1.example.com", ttl: 300, priority: 10 },
      { type: "CNAME", data: "mail.example.net" },
    );
    expect(merged).toEqual({ host: "mail", type: "CNAME", data: "mail.example.net", ttl: 300 });
  });

  it("keeps type-specific fields given in the patch when it changes the type", () => {
    const merged = mergeRecord(
      { host: "@", type: "CAA", data: "letsencrypt.org", flags: 0, tag: "issue" },
      { type: "MX", data: "mx.example.com", priority: 5 },
    );
    expect(merged).toEqual({ host: "@", type: "MX", data: "mx.example.com", priority: 5 });
  });

  it("treats a type that differs only in case as unchanged", () => {
    const merged = mergeRecord(
      { host: "@", type: "MX", data: "mx1.example.com", priority: 10 },
      { type: "mx" },
    );
    expect(merged).toMatchObject({ priority: 10 });
  });
});

describe("pickRecord", () => {
  it("keeps only the record fields that are set", () => {
    const args = {
      domain_id: 42,
      record_id: 7,
      host: "_sip._tcp",
      type: "SRV",
      data: "sip.example.com",
      ttl: undefined,
      priority: 0,
      weight: 5,
      port: 5060,
    };
    expect(pickRecord(args)).toEqual({
      host: "_sip._tcp",
      type: "SRV",
      data: "sip.example.com",
      priority: 0,
      weight: 5,
      port: 5060,
    });
  });
});
