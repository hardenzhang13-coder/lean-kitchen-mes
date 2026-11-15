import { validateDishForPublish } from "../dish-publish";

const validDish = {
  name: "宫保鸡丁",
  categoryId: 1,
  cuisine: "川菜",
  technique: "爆炒",
  taste: "香辣",
  meatType: "荤菜",
  netDetails: [{ role: "main" }, { role: "support" }],
};

describe("菜品发布校验", () => {
  it("完整档案通过校验", () => {
    expect(validateDishForPublish(validDish)).toBeNull();
  });

  it("基础信息缺失时返回具体提示", () => {
    expect(validateDishForPublish({ ...validDish, name: "  " })).toBe(
      "菜品名称不能为空"
    );
    expect(validateDishForPublish({ ...validDish, categoryId: null })).toBe(
      "请选择菜品类别"
    );
    expect(validateDishForPublish({ ...validDish, cuisine: null })).toBe(
      "请选择菜系"
    );
    expect(validateDishForPublish({ ...validDish, technique: null })).toBe(
      "请选择做法"
    );
    expect(validateDishForPublish({ ...validDish, taste: null })).toBe(
      "请选择口味"
    );
    expect(validateDishForPublish({ ...validDish, meatType: null })).toBe(
      "请选择荤素类型"
    );
  });

  it("主料与辅料为发布必填", () => {
    expect(
      validateDishForPublish({ ...validDish, netDetails: [{ role: "support" }] })
    ).toBe("主料不能为空");
    expect(
      validateDishForPublish({ ...validDish, netDetails: [{ role: "main" }] })
    ).toBe("辅料不能为空");
    expect(validateDishForPublish({ ...validDish, netDetails: [] })).toBe(
      "主料不能为空"
    );
    expect(validateDishForPublish({ ...validDish, netDetails: null })).toBe(
      "主料不能为空"
    );
  });
});
