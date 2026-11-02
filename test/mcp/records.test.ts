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
