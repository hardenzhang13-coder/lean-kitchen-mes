import {
  DEFAULT_PACKAGE_SPEC,
  NET_NAME_METHOD_PLACEHOLDER,
  buildNetIngredientDefaultName,
  isDefaultNetIngredientName,
} from "../net-name";

describe("净料默认名称", () => {
  it("按「原料名称•加工方式•克数」生成", () => {
    expect(buildNetIngredientDefaultName("红杭椒", "500")).toBe(
      "红杭椒•加工方式•500g"
    );
    expect(buildNetIngredientDefaultName("平包菜", 500)).toBe(
      "平包菜•加工方式•500g"
    );
  });

  it("克数缺省或非法时按 500g", () => {
    expect(buildNetIngredientDefaultName("红杭椒")).toBe(
      `红杭椒•${NET_NAME_METHOD_PLACEHOLDER}•${DEFAULT_PACKAGE_SPEC}g`
    );
    expect(buildNetIngredientDefaultName("红杭椒", "")).toBe(
      "红杭椒•加工方式•500g"
    );
    expect(buildNetIngredientDefaultName("红杭椒", "abc")).toBe(
      "红杭椒•加工方式•500g"
    );
    expect(buildNetIngredientDefaultName("红杭椒", 0)).toBe(
      "红杭椒•加工方式•500g"
    );
  });

  it("没有来源原料名称时返回空串", () => {
    expect(buildNetIngredientDefaultName(null)).toBe("");
    expect(buildNetIngredientDefaultName(undefined)).toBe("");
    expect(buildNetIngredientDefaultName("   ")).toBe("");
  });

  it("能识别自动生成的默认名", () => {
    expect(isDefaultNetIngredientName("红杭椒•加工方式•500g")).toBe(true);
    expect(isDefaultNetIngredientName("红杭椒•切片•500g")).toBe(false);
    expect(isDefaultNetIngredientName("红杭椒")).toBe(false);
    expect(isDefaultNetIngredientName("")).toBe(false);
    expect(isDefaultNetIngredientName(null)).toBe(false);
  });
});
