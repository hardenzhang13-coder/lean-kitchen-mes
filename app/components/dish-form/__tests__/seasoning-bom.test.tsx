/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BomItemRow } from "../bom-item-row";
import { BomPickerDialog } from "../bom-picker-dialog";
import {
  bomToPayload,
  dishToBom,
  emptyBom,
  normalizeSeasoningProducts,
  type BomItem,
  type DishDetail,
  type IngredientOption,
} from "../types";

const productOption: IngredientOption = {
  id: 50,
  code: "SP-0001",
  name: "蒸鱼双椒酱•1200g",
  productName: "双椒酱原料",
  spec: "1200g",
  unitPrice: 120,
  costPrice: 12.5,
  packageSpec: 1200,
  portion: "单人份",
  standardPackagePrice: 30,
  unit: "斤",
  productType: "单品调料",
};

const productBomItem: BomItem = {
  id: "sea-50-1",
  sourceId: 50,
  specId: 50,
  name: "蒸鱼双椒酱•1200g",
  productName: null,
  spec: "1200g",
  amountG: "10",
  unitPrice: 120,
  unit: "斤",
  costPrice: 12.5,
  cost: 0.25,
  portion: "单人份",
  productType: "单品调料",
};

describe("菜品 BOM 调料：选产物 + 克需求口径", () => {
  it("读取菜品产物行按出库价计算行成本（存量旧口径行按每斤单价）", () => {
    const dish = {
      id: 5,
      code: "DSH-0005",
      name: "红烧肉",
      seasoningDetails: [
        {
          sourceId: 0,
          specId: 50,
          amountG: 10,
          name: "蒸鱼双椒酱•1200g",
          pricePerJin: 12.5,
          packageSpec: 1200,
          portion: "单人份",
          productType: "单品调料",
        },
        {
          sourceId: 30,
          specId: null,
          amountG: 10,
          name: "生抽",
          pricePerJin: 10,
          spec: "1.9L*6",
        },
      ],
    } as unknown as DishDetail;

    const bom = dishToBom(dish);
    expect(bom.seasoning).toHaveLength(2);
    // 产物行：成本 = 出库价 × g ÷ 500
    expect(bom.seasoning[0].specId).toBe(50);
    expect(bom.seasoning[0].amountG).toBe("10");
    expect(bom.seasoning[0].costPrice).toBe(12.5);
    expect(bom.seasoning[0].cost).toBe(0.25);
    expect(bom.seasoning[0].productType).toBe("单品调料");
    // 旧口径行：成本 = 每斤单价 × g ÷ 500
    expect(bom.seasoning[1].specId).toBeNull();
    expect(bom.seasoning[1].cost).toBe(0.2);
  });

  it("提交载荷：产物行输出 specId，旧口径行输出 sourceId", () => {
    const legacyItem: BomItem = {
      ...productBomItem,
      id: "sea-30-1",
      sourceId: 30,
      specId: null,
      name: "生抽",
      productType: null,
      costPrice: 10,
      cost: 0.2,
    };
    const payload = bomToPayload({
      ...emptyBom(),
      seasoning: [productBomItem, legacyItem],
    });

    expect(payload.seasoningDetails).toEqual([
      { specId: 50, amountG: 10, brand: null },
      { sourceId: 30, amountG: 10, brand: null },
    ]);
  });

  it("产物归一化取出库价与包装规格", () => {
    const [option] = normalizeSeasoningProducts([
      {
        id: 50,
        code: "SP-0001",
        name: "蒸鱼双椒酱•1200g",
        productType: "单品调料",
        packageSpec: 1200,
        unitPrice: 120,
        outPricePerJin: 12.5,
        standardPackagePrice: 30,
        sourceIngredient: { name: "双椒酱原料" },
      },
    ]);
    expect(option.costPrice).toBe(12.5);
    expect(option.packageSpec).toBe(1200);
    expect(option.spec).toBe("1200g");
    expect(option.productType).toBe("单品调料");
  });

  it("调料行可改克数并即时重算行成本", () => {
    const onChange = jest.fn();
    render(
      <BomItemRow
        type="seasoning"
        index={0}
        item={productBomItem}
        onRemove={jest.fn()}
        onChange={onChange}
      />
    );

    const input = screen.getByLabelText("蒸鱼双椒酱•1200g 用量") as HTMLInputElement;
    expect(input.value).toBe("10");

    fireEvent.change(input, { target: { value: "20" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ amountG: "20", cost: 0.5 })
    );
  });

  it("调料选择弹窗展示产物列与用量输入，不展示分类筛选", async () => {
    const onSelect = jest.fn();
    render(
      <BomPickerDialog
        open
        onOpenChange={jest.fn()}
        type="seasoning"
        onSelect={onSelect}
        refs={{ ingredientCategories: [] }}
        onLoadItems={async () => [productOption]}
        showAmountInput
        defaultAmountG="10"
        singleSelect
      />
    );

    await waitFor(() =>
      expect(screen.getByText("蒸鱼双椒酱•1200g")).toBeInTheDocument()
    );
    // 产物列：产物名称 / 包装规格 / 出库价 / 标准规格价 / 来源
    expect(screen.getByText("产物名称")).toBeInTheDocument();
    expect(screen.getByText("包装规格")).toBeInTheDocument();
    expect(screen.getByText("出库价")).toBeInTheDocument();
    expect(screen.getByText("标准规格价")).toBeInTheDocument();
    expect(screen.getByText("来源")).toBeInTheDocument();
    // 产物层不挂分类体系：无分类级联
    expect(screen.queryByText("全部分类")).not.toBeInTheDocument();
    // 用量输入框在底部按钮旁，数字与单位加粗
    const amountInput = screen.getByLabelText("用量") as HTMLInputElement;
    expect(amountInput.value).toBe("10");
    expect(amountInput.className).toContain("font-bold");
    const unit = screen.getByText("g");
    expect(unit.className).toContain("font-bold");

    fireEvent.click(screen.getByText("蒸鱼双椒酱•1200g").closest("tr")!);
    fireEvent.click(screen.getByText("确认选择"));

    expect(onSelect).toHaveBeenCalledWith([
      { option: productOption, amountG: "10" },
    ]);
  });
});
