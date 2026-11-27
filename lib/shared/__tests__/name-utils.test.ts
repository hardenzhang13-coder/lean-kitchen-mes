import { stripNamePackageSpec, syncNamePackageSpec } from "../name-utils";

describe("净料/小料名称与封装规格同步", () => {
  it("替换名称末尾的规格数字", () => {
    expect(syncNamePackageSpec("平包菜•称重•500g", 600)).toBe(
      "平包菜•称重•600g"
    );
    expect(syncNamePackageSpec("肉片 500g", 800)).toBe("肉片 800g");
    expect(syncNamePackageSpec("五花肉 3:7 500g", 750)).toBe(
      "五花肉 3:7 750g"
    );
    expect(syncNamePackageSpec("净料500克", 600)).toBe("净料600g");
  });

  it("名称没有末尾规格时保持原样", () => {
    expect(syncNamePackageSpec("鸡丁", 600)).toBe("鸡丁");
    expect(syncNamePackageSpec(" 鸡丁 ", 600)).toBe("鸡丁");
  });

  it("规格非法时不改写名称", () => {
    expect(syncNamePackageSpec("鸡丁•500g", 0)).toBe("鸡丁•500g");
    expect(syncNamePackageSpec("鸡丁•500g", Number.NaN)).toBe("鸡丁•500g");
  });
});

describe("stripNamePackageSpec 切法身份", () => {
  it("去掉末尾规格段（含分隔符）", () => {
    expect(stripNamePackageSpec("胡萝卜•直切•1.5厘丁•10g")).toBe(
      "胡萝卜•直切•1.5厘丁"
    );
    expect(stripNamePackageSpec("蒜米•机切3毫片•10g")).toBe("蒜米•机切3毫片");
    expect(stripNamePackageSpec("肉片 500g")).toBe("肉片");
    expect(stripNamePackageSpec("净料500克")).toBe("净料");
  });

  it("同切法不同规格判定一致，不同切法判定不同", () => {
    expect(stripNamePackageSpec("鸡丁•100g")).toBe(
      stripNamePackageSpec("鸡丁•300g")
    );
    expect(stripNamePackageSpec("鸡丁•100g")).not.toBe(
      stripNamePackageSpec("鸡丝•300g")
    );
  });

  it("无末尾规格时原样返回", () => {
    expect(stripNamePackageSpec("葱花")).toBe("葱花");
    expect(stripNamePackageSpec(" 葱花 ")).toBe("葱花");
  });
});
