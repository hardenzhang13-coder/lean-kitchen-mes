/** @jest-environment jsdom */

import { act, render, screen } from "@testing-library/react";
import { IngredientFormFields } from "../ingredient-form-fields";
import type {
  CategoryL1,
  IngredientFormData,
} from "../ingredient-form-fields";

const categories: CategoryL1[] = [
  {
    code: "VEG",
    name: "蔬菜",
    children: [{ code: "VEG-LEF", name: "叶菜" }],
  },
];

const units = [{ id: 1, name: "斤", category: "重量" }];

beforeEach(() => {
  // 供应商选择器会在挂载时拉列表
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ data: [] }),
  })) as jest.MockedFunction<typeof fetch>;
});

const baseForm: IngredientFormData = {
  name: "",
  l1Code: "",
  l2Code: "",
  l3Code: "",
  alias: "",
  seasoningType: "",
  purchaseSpec: "",
  purchaseUnit: "",
  stockUnit: "",
  unitsPerPurchase: "",
  latestRefPrice: "",
  pricePerJin: "",
  yieldRate: "",
  defaultSupplierId: "",
};

describe("调味品不再挂分类树", () => {
  it("调味品模式不出现分类字段，只保留「调料分类」", async () => {
    render(
      <IngredientFormFields
        form={baseForm}
        onChange={jest.fn()}
        errors={{}}
        categories={categories}
        units={units}
        mode="seasoning"
      />
    );
    // 等供应商列表请求落地，避免异步 setState 落在断言之外
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText("调味品分类")).not.toBeInTheDocument();
    expect(screen.queryByText("食材分类")).not.toBeInTheDocument();
    expect(screen.getByText("调料分类")).toBeInTheDocument();
  });

  it("食材模式仍要求三级级联分类", async () => {
    render(
      <IngredientFormFields
        form={baseForm}
        onChange={jest.fn()}
        errors={{}}
        categories={categories}
        units={units}
        mode="ingredient"
      />
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("食材分类")).toBeInTheDocument();
    expect(screen.queryByText("调料分类")).not.toBeInTheDocument();
  });
});
