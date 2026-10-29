import { parseCSVLine, parseCSV, buildCSV } from "../csv";

describe("parseCSVLine", () => {
  it("splits simple comma-separated fields", () => {
    expect(parseCSVLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace around fields", () => {
    expect(parseCSVLine("  a  , b ,c ")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCSVLine('"a,b",c')).toEqual(["a,b", "c"]);
  });

  it("handles escaped quotes", () => {
    expect(parseCSVLine('"a""b",c')).toEqual(['a"b', "c"]);
  });

  it("returns a single empty field for an empty line", () => {
    expect(parseCSVLine("")).toEqual([""]);
  });
});

describe("parseCSV", () => {
  it("parses multiple lines", () => {
    const text = "a,b\nc,d";
    expect(parseCSV(text)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("strips BOM from the start", () => {
    const text = "﻿a,b\nc,d";
    expect(parseCSV(text)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("filters out blank lines", () => {
    const text = "a,b\n\n  \nc,d";
    expect(parseCSV(text)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("buildCSV", () => {
  it("joins rows with commas and lines with newlines", () => {
    expect(buildCSV([["a", "b"], ["c", "d"]])).toBe("a,b\nc,d");
  });

  it("escapes commas", () => {
    expect(buildCSV([["a,b", "c"]])).toBe('"a,b",c');
  });

  it("escapes quotes", () => {
    expect(buildCSV([["a\"b", "c"]])).toBe('"a""b",c');
  });

  it("escapes newlines", () => {
    expect(buildCSV([["a\nb", "c"]])).toBe('"a\nb",c');
  });

  it("returns empty string for empty rows", () => {
    expect(buildCSV([])).toBe("");
  });
});
