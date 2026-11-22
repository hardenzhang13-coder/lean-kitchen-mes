/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BomItemRow } from "../bom-item-row";
import { BomPickerDialog } from "../bom-picker-dialog";
import {
  bomToPayload,
  dishToBom,
  emptyBom,
  normalizeIngredients,
  type BomItem,
  type DishDetail,
  type IngredientOption,
} from "../types";

const seasoningOption: IngredientOption = {
  id: 30,
  code: "SEA-SOL-0030",
  name: "生抽",
  productName: "海天",
  spec: "1.9L*6",
  unitPrice: 120,
  costPrice: 10,
  unit: "斤",
  l2Code: "SEA-SOL",
};

const seasoningBomItem: BomItem = {
  id: "sea-30-1",
  sourceId: 30,
  name: "生抽",
  productName: "海天",
  spec: "1.9L*6",
  amountG: "10",
  unitPrice: 120,
  unit: "斤",
  costPrice: 10,
  cost: 0.2,
  portion: null,
  l2Code: "SEA-SOL",
};

describe("菜品 BOM 调料：来源调料 + 克需求口径", () => {
  it("读取菜品时按存储克数与每斤单价计算行成本", () => {
    const dish = {
      id: 5,
      code: "DSH-0005",
      name: "红烧肉",
      status: "draft",
      seasoningDetails: [
        {
          sourceId: 30,
          amountG: 10,
          name: "生抽",
          pricePerJin: 10,
          spec: "1.9L*6",
        },
      ],
    } as unknown as DishDetail;

    const bom = dishToBom(dish);
    expect(bom.seasoning).toHaveLength(1);
    expect(bom.seasoning[0].amountG).toBe("10");
    expect(bom.seasoning[0].costPrice).toBe(10);
    expect(bom.seasoning[0].cost).toBe(0.2);
    expect(bom.seasoning[0].portion).toBeNull();
  });

  it("提交载荷只带来源调料与克数，不再输出标准规格", () => {
    const payload = bomToPayload({
      ...emptyBom(),
      seasoning: [seasoningBomItem],
    });

    expect(payload.seasoningDetails).toEqual([
      { sourceId: 30, amountG: 10, brand: "海天" },
    ]);
    expect(payload.seasoningDetails[0]).not.toHaveProperty("specId");
  });

  it("调料归一化取每斤单价与采购规格", () => {
    const [option] = normalizeIngredients([
      {
        id: 30,
        code: "SEA-SOL-0030",
        name: "生抽",
        alias: "海天",
        purchaseSpec: "1.9L*6",
        latestRefPrice: 120,
        pricePerJin: 10,
        l2Code: "SEA-SOL",
      },
    ]);
    expect(option.costPrice).toBe(10);
    expect(option.spec).toBe("1.9L*6");
  });

  it("调料行可改克数并即时重算行成本", () => {
    const onChange = jest.fn();
    render(
      <BomItemRow
        type="seasoning"
        index={0}
        item={seasoningBomItem}
        onRemove={jest.fn()}
        onChange={onChange}
      />
    );

    const input = screen.getByLabelText("生抽 用量") as HTMLInputElement;
    expect(input.value).toBe("10");

    fireEvent.change(input, { target: { value: "15" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ amountG: "15", cost: 0.3 })
    );
  });

  it("调料选择弹窗展示用量输入并把克数回传", async () => {
    const onSelect = jest.fn();
    render(
      <BomPickerDialog
        open
        onOpenChange={jest.fn()}
        type="seasoning"
        onSelect={onSelect}
        refs={{
          ingredientCategories: [
            {
              code: "SEA",
              name: "调味品",
              children: [{ code: "SEA-SOL", name: "酱油", parentCode: "SEA" }],
            },
          ],
        }}
        onLoadItems={async () => [seasoningOption]}
        showAmountInput
        defaultAmountG="10"
        singleSelect
      />
    );

    await waitFor(() => expect(screen.getByText("生抽")).toBeInTheDocument());
    // 调料字段：调料名称 / 商品名称 / 采购规格 / 每斤单价
    expect(screen.getByText("调料名称")).toBeInTheDocument();
    expect(screen.getByText("商品名称")).toBeInTheDocument();
    expect(screen.getByText("采购规格")).toBeInTheDocument();
    expect(screen.getByText("每斤单价")).toBeInTheDocument();
    // 调料不展示份量与标准规格价
    expect(screen.queryByText("包装份量")).not.toBeInTheDocument();
    expect(screen.queryByText("标准规格价")).not.toBeInTheDocument();
    // 用量输入框在底部按钮旁，数字与单位加粗
    const amountInput = screen.getByLabelText("用量") as HTMLInputElement;
    expect(amountInput.value).toBe("10");
    expect(amountInput.className).toContain("font-bold");
    const unit = screen.getByText("g");
    expect(unit.className).toContain("font-bold");

    fireEvent.click(screen.getByText("生抽").closest("tr")!);
    fireEvent.click(screen.getByText("确认选择"));

    expect(onSelect).toHaveBeenCalledWith([
      { option: seasoningOption, amountG: "10" },
    ]);
  });
});