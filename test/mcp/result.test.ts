import { describe, expect, it } from "vitest";
import { errorResult, jsonResult, listResult, textResult } from "#mcp/result.js";

describe("results", () => {
  it("adds structuredContent only for plain objects", () => {
    expect(jsonResult({ a: 1 }).structuredContent).toEqual({ a: 1 });
    expect(jsonResult([1, 2])).not.toHaveProperty("structuredContent");
    expect(jsonResult(null)).not.toHaveProperty("structuredContent");
    expect(jsonResult("text")).not.toHaveProperty("structuredContent");
  });

  it("wraps lists under a key in structuredContent but not in the text", () => {
    const result = listResult("items", [1]);
    expect(result.structuredContent).toEqual({ items: [1] });
    expect(result.content).toEqual([{ type: "text", text: "[\n  1\n]" }]);
  });

  it("returns plain text", () => {
    expect(textResult("hi")).toEqual({ content: [{ type: "text", text: "hi" }] });
  });

  it("turns any thrown value into an isError result", () => {
    expect(errorResult(new Error("boom"))).toEqual({
      content: [{ type: "text", text: "boom" }],
      isError: true,
    });
    expect(errorResult("plain")).toMatchObject({ content: [{ text: "plain" }], isError: true });
  });
});
