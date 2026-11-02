import { describe, expect, it } from "vitest";
import { assertDefined } from "#domeneshop/assert.js";

describe("assertDefined", () => {
  it("returns a defined value, including falsy ones", () => {
    expect(assertDefined(0, "unused")).toBe(0);
    expect(assertDefined(null, "unused")).toBeNull();
  });

  it("throws the given message for undefined", () => {
    expect(() => assertDefined(undefined, "nothing here")).toThrow("nothing here");
  });
});
