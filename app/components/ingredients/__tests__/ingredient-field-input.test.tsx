/** @jest-environment jsdom */

import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { IngredientFieldInput } from "../ingredient-field-input";
import {
  IngredientFormFields,
  type IngredientFormData,
} from "../ingredient-form-fields";
import { IngredientNumberInput } from "../ingredient-number-input";
import { useIngredientForm } from "../use-ingredient-form";

describe("食材域输入控件", () => {
  it("原料输入框聚焦时隐藏占位，失焦为空时恢复", () => {
    render(
      <IngredientFieldInput
        aria-label="采购规格"
        placeholder="如 5斤/袋"
        hidePlaceholderOnFocus
      />
    );
    const input = screen.getByLabelText("采购规格");

    expect(input).toHaveAttribute("placeholder", "如 5斤/袋");
    fireEvent.focus(input);
    expect(input).toHaveAttribute("placeholder", "");
    fireEvent.blur(input);
    expect(input).toHaveAttribute("placeholder", "如 5斤/袋");
  });

  it("食材数字输入禁止键盘步进并保留手动录入", () => {
    const handleChange = jest.fn();
    render(
      <IngredientNumberInput
        aria-label="最新参照单价"
        defaultValue="10"
        onChange={handleChange}
      />
    );
    const input = screen.getByLabelText("最新参照单价");

    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("inputmode", "decimal");
    for (const key of ["ArrowUp", "ArrowDown", "PageUp", "PageDown"]) {
      expect(fireEvent.keyDown(input, { key })).toBe(false);
    }
    expect(fireEvent.keyDown(input, { key: "1" })).toBe(true);

    fireEvent.change(input, { target: { value: "12.5" } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue(12.5);
  });

  it("聚焦时鼠标滚轮不会改变数字输入", () => {
    render(<IngredientNumberInput aria-label="用量" defaultValue="100" />);
    const input = screen.getByLabelText("用量");
    input.focus();
    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
    });

    input.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(input).toHaveValue(100);
  });

  it("原料只读抽屉使用同步后的字段分组和专属标签", () => {
    const form: IngredientFormData = {
      name: "带皮五花肉",
      l1Code: "MEA",
      l2Code: "MEA-POR",
      alias: "双汇",
      purchaseSpec: "散称",
      purchaseUnit: "斤",
      stockUnit: "斤",
      unitsPerPurchase: "1",
      latestRefPrice: "18.5",
      pricePerJin: "18.5",
      defaultSupplierId: "7",
    };

    render(
      <IngredientFormFields
        form={form}
        onChange={jest.fn()}
        errors={{}}
        categories={[
          {
            code: "MEA",
            name: "肉类",
            children: [{ code: "MEA-POR", name: "猪肉" }],
          },
        ]}
        units={[{ id: 1, name: "斤", category: "weight" }]}
        mode="ingredient"
        l2Open={false}
        onL2OpenChange={jest.fn()}
        viewMode
        layout="sheet"
        supplierName="京鲜肉联配送中心"
      />
    );

    expect(screen.queryByRole("heading", { name: "核心信息" })).not.toBeInTheDocument();
    const basicHeading = screen.getByRole("heading", { name: "基础信息" });
    expect(basicHeading).toBeInTheDocument();
    expect(basicHeading.parentElement?.nextElementSibling).toHaveClass(
      "xl:grid-cols-3"
    );
    expect(
      screen.getByRole("heading", { name: "采购与计量" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "价格与供应商" })
    ).toBeInTheDocument();
    expect(screen.getByText("品牌名称")).toBeInTheDocument();
    expect(screen.getByText("供应商名称")).toBeInTheDocument();
    expect(screen.getByText("京鲜肉联配送中心")).toBeInTheDocument();
    expect(screen.queryByText("商品名称")).not.toBeInTheDocument();
    expect(screen.queryByText("默认供应商")).not.toBeInTheDocument();
    expect(screen.queryByText("季节")).not.toBeInTheDocument();
    expect(screen.queryByText("储存方式")).not.toBeInTheDocument();
  });

  it("新增原料保留常用默认值", () => {
    const { result } = renderHook(() =>
      useIngredientForm({
        active: true,
        categories: [],
        units: [],
        mode: "ingredient",
        onSaved: jest.fn(),
      })
    );

    expect(result.current.form.purchaseSpec).toBe("散称");
    expect(result.current.form.purchaseUnit).toBe("斤");
    expect(result.current.form.stockUnit).toBe("斤");
    expect(result.current.form.unitsPerPurchase).toBe("1");
  });

  it("查看态空值不显示占位符", () => {
    const form: IngredientFormData = {
      name: "带皮五花肉",
      l1Code: "MEA",
      l2Code: "MEA-POR",
      alias: "",
      purchaseSpec: "散称",
      purchaseUnit: "斤",
      stockUnit: "斤",
      unitsPerPurchase: "1",
      latestRefPrice: "",
      pricePerJin: "",
      defaultSupplierId: "",
    };

    render(
      <IngredientFormFields
        form={form}
        onChange={jest.fn()}
        errors={{}}
        categories={[
          {
            code: "MEA",
            name: "肉类",
            children: [{ code: "MEA-POR", name: "猪肉" }],
          },
        ]}
        units={[{ id: 1, name: "斤", category: "weight" }]}
        mode="ingredient"
        l2Open={false}
        onL2OpenChange={jest.fn()}
        viewMode
        layout="sheet"
      />
    );

    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
