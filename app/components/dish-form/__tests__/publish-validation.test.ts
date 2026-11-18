import {
  dishToFormData,
  emptyBom,
  validateForSave,
  validatePublish,
  type DishDetail,
  type DishFormData,
} from "../types";

const form: DishFormData = {
  name: "宫保鸡丁",
  intro: "",
  categoryId: "",
  cuisine: "",
  technique: "",
  taste: "",
  portion: "小碗菜·10份",
  season: "四季",
  meatType: "荤菜",
  price: "18",
};

const mainBom = {
  ...emptyBom(),
  main: [
    {
      id: "net-1",
      sourceId: 1,
      name: "鸡丁",
      amountG: "100",
      unitPrice: 0,
      unit: "斤",
      costPrice: 12,
    },
  ],
};

describe("菜品表单提交校验", () => {
  it("辅料留空、类别/菜系/做法/口味留空也可发布", () => {
    expect(validatePublish(form, mainBom, 12)).toBeNull();
  });

  it("发布要求主料不为空", () => {
    expect(validatePublish(form, emptyBom(), null)).toBe("主料不能为空");
  });

  it("售价缺失时给出人性化提示", () => {
    expect(validatePublish({ ...form, price: "" }, mainBom, 12)).toBe(
      "请填写售价（元/份），毛利率会根据成本自动计算"
    );
    expect(validateForSave({ ...form, price: "" }, 12)).toBe(
      "请填写售价（元/份），毛利率会根据成本自动计算"
    );
  });

  it("发布时成本缺失导致毛利率无法派生，提示先添加用料", () => {
    expect(validatePublish(form, mainBom, null)).toBe(
      "请先在「菜品用料」中添加主料，毛利率会根据用料成本自动计算"
    );
  });

  it("保存草稿只要求售价，不阻断无用料的新建", () => {
    expect(validateForSave(form, null)).toBeNull();
  });

  it("存量菜品缺少份量时回退到小碗菜·10份", () => {
    const dish = {
      id: 1,
      code: "DSH-HOT-0001",
      name: "宫保鸡丁",
      intro: null,
      portion: null,
      status: "draft",
    } as DishDetail;
    expect(dishToFormData(dish).portion).toBe("小碗菜·10份");
  });
});
