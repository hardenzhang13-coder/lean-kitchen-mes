/** @jest-environment jsdom */

import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { IngredientFormDialog } from "../ingredient-form-dialog";
import { useIngredientForm } from "../use-ingredient-form";

const categories = [
  {
    code: "VEG",
    name: "蔬菜",
    children: [{ code: "VEG-LEF", name: "叶菜" }],
  },
];

const units = [{ id: 1, name: "斤", category: "重量" }];

beforeEach(() => {
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input);
    if (url.includes("/check-name")) {
      return { ok: true, json: async () => ({ exists: false }) } as Response;
    }
    if (init?.method === "POST") {
      return {
        ok: true,
        json: async () => ({
          data: { id: 9, name: "带皮五花肉", l2Code: "VEG-LEF" },
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({ data: [] }) } as Response;
  }) as jest.MockedFunction<typeof fetch>;
});

describe("新增原料的连续录入", () => {
  it("新建模式提供「保存并继续添加」，编辑模式不提供", () => {
    const { rerender } = render(
      <IngredientFormDialog
        open
        onOpenChange={jest.fn()}
        categories={categories}
        units={units}
        mode="ingredient"
        allowContinue
        onSuccess={jest.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "保存并继续添加" })
    ).toBeInTheDocument();

    rerender(
      <IngredientFormDialog
        open
        onOpenChange={jest.fn()}
        categories={categories}
        units={units}
        mode="ingredient"
        allowContinue
        initialData={{ id: 3, name: "带皮五花肉", l2Code: "VEG-LEF" }}
        onSuccess={jest.fn()}
      />
    );

    expect(
      screen.queryByRole("button", { name: "保存并继续添加" })
    ).not.toBeInTheDocument();
  });

  it("新增原料的三个分组不使用浅色背景", () => {
    render(
      <IngredientFormDialog
        open
        onOpenChange={jest.fn()}
        categories={categories}
        units={units}
        mode="ingredient"
        allowContinue
        onSuccess={jest.fn()}
      />
    );

    expect(document.querySelector("[class*=bg-sky-50]")).not.toBeInTheDocument();
    expect(document.querySelector("[class*=bg-amber-50]")).not.toBeInTheDocument();
    expect(document.querySelector("[class*=bg-emerald-50]")).not.toBeInTheDocument();
  });

  it("调料沿用食材三分组结构并保留调料字段名称", () => {
    render(
      <IngredientFormDialog
        open
        onOpenChange={jest.fn()}
        categories={[
          {
            code: "SEA",
            name: "调味品",
            children: [{ code: "SEA-SOY", name: "酱油" }],
          },
        ]}
        units={units}
        mode="seasoning"
        initialData={{ l2Code: "SEA-SOY" }}
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "基础信息" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "采购与计量" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "价格与供应商" })).toBeInTheDocument();
    expect(screen.getByText(/调料名称/)).toBeInTheDocument();
    expect(document.body).toHaveTextContent("商品名称");
    expect(document.body).toHaveTextContent("默认供应商");
  });

  it("保存并继续添加：成功后保留分类与单位、清空名称", async () => {
    const onSaved = jest.fn();
    const { result } = renderHook(() =>
      useIngredientForm({
        active: true,
        categories,
        units,
        mode: "ingredient",
        onSaved,
      })
    );

    act(() => {
      result.current.handleChange("name", "带皮五花肉");
      result.current.handleChange("l1Code", "VEG");
      result.current.handleChange("l2Code", "VEG-LEF");
    });

    await act(async () => {
      await result.current.submitContinue();
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0][1]).toBe(true);
    expect(result.current.form.name).toBe("");
    expect(result.current.form.l2Code).toBe("VEG-LEF");
    expect(result.current.form.purchaseUnit).toBe("斤");
    expect(result.current.form.stockUnit).toBe("斤");
  });

  it("普通保存不进入连续录入模式", async () => {
    const onSaved = jest.fn();
    const { result } = renderHook(() =>
      useIngredientForm({
        active: true,
        categories,
        units,
        mode: "ingredient",
        onSaved,
      })
    );

    act(() => {
      result.current.handleChange("name", "带皮五花肉");
      result.current.handleChange("l1Code", "VEG");
      result.current.handleChange("l2Code", "VEG-LEF");
    });

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0][1]).toBe(false);
    expect(result.current.form.name).toBe("带皮五花肉");
  });
});
