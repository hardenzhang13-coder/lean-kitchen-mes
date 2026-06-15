import { formatWeight, toWeightValue } from "../schedule-utils";

describe("formatWeight", () => {
  it("shows jin when weight is at least 500g", () => {
    expect(formatWeight(500)).toBe("1.00斤");
    expect(formatWeight(1000)).toBe("2.00斤");
    expect(formatWeight(750)).toBe("1.50斤");
  });

  it("shows grams when weight is less than 500g", () => {
    expect(formatWeight(0)).toBe("0g");
    expect(formatWeight(100)).toBe("100g");
    expect(formatWeight(499)).toBe("499g");
  });
});

describe("toWeightValue", () => {
  it("returns jin value when weight is at least 500g", () => {
    expect(toWeightValue(500)).toEqual({ value: 1, unit: "斤" });
    expect(toWeightValue(1000)).toEqual({ value: 2, unit: "斤" });
  });

  it("returns rounded grams when weight is less than 500g", () => {
    expect(toWeightValue(0)).toEqual({ value: 0, unit: "g" });
    expect(toWeightValue(100)).toEqual({ value: 100, unit: "g" });
    expect(toWeightValue(499.6)).toEqual({ value: 500, unit: "g" });
  });
});
