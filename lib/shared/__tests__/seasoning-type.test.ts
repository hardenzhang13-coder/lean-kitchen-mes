import {
  SEASONING_TYPES,
  SEASONING_TYPE_OPTIONS,
  getSeasoningTypeOption,
  isSeasoningType,
} from "@/lib/shared/seasoning-type";

describe("seasoning-type 五件套", () => {
  it("枚举值与选项元数据一一对应", () => {
    expect(SEASONING_TYPES).toEqual(["单品调料", "复合调料", "成品酱料"]);
    expect(SEASONING_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      ...SEASONING_TYPES,
    ]);
    expect(SEASONING_TYPE_OPTIONS.every((o) => o.label && o.description)).toBe(
      true
    );
  });

  it("取值解析：合法返回选项，非法与空返回 null", () => {
    expect(getSeasoningTypeOption("单品调料")?.label).toBe("单品调料");
    expect(getSeasoningTypeOption("不存在的类型")).toBeNull();
    expect(getSeasoningTypeOption("")).toBeNull();
    expect(getSeasoningTypeOption(null)).toBeNull();
    expect(getSeasoningTypeOption(undefined)).toBeNull();
  });

  it("合法性判断：仅接受三个合法标签", () => {
    expect(isSeasoningType("复合调料")).toBe(true);
    expect(isSeasoningType("成品酱料")).toBe(true);
    expect(isSeasoningType("基础调味品")).toBe(false);
    expect(isSeasoningType("")).toBe(false);
    expect(isSeasoningType(null)).toBe(false);
    expect(isSeasoningType(42)).toBe(false);
  });
});
