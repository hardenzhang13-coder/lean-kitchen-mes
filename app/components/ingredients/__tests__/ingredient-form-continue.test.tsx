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

describe("新增食材的连续录入", () => {
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

  it("新增食材的三个分组不使用浅色背景", () => {
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
    expect(screen.getByRole("heading", { name: "价格与出成率" })).toBeInTheDocument();
    expect(screen.getByText(/调味品名称/)).toBeInTheDocument();
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

  it("调味品保存时提交调味品域分类，未选分类则提交 null", async () => {
    const seaCategories = [
      {
        code: "SEA",
        name: "调味品",
        children: [{ code: "SEA-SPC", name: "香辛料" }],
      },
    ];
    const onSaved = jest.fn();
    const { result } = renderHook(() =>
      useIngredientForm({
        active: true,
        categories: seaCategories,
        units,
        mode: "seasoning",
        onSaved,
      })
    );

    act(() => {
      result.current.handleChange("name", "八角");
      result.current.handleChange("alias", "八角");
      result.current.handleChange("seasoningType", "single");
      result.current.handleChange("purchaseSpec", "散称");
      result.current.handleChange("purchaseUnit", "斤");
      result.current.handleChange("stockUnit", "斤");
      result.current.handleChange("l1Code", "SEA");
      result.current.handleChange("l2Code", "SEA-SPC");
    });

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST"
    );
    const body = JSON.parse(String((postCall?.[1] as RequestInit).body));
    expect(body.kind).toBe("seasoning");
    expect(body.l2Code).toBe("SEA-SPC");
    expect(body.l3Code).toBeNull();

    // 不选分类：l2Code/l3Code 均为 null（可空、不做强限制）
    const onSaved2 = jest.fn();
    const { result: result2 } = renderHook(() =>
      useIngredientForm({
        active: true,
        categories: seaCategories,
        units,
        mode: "seasoning",
        onSaved: onSaved2,
      })
    );
    act(() => {
      result2.current.handleChange("name", "香叶");
      result2.current.handleChange("alias", "香叶");
      result2.current.handleChange("seasoningType", "single");
      result2.current.handleChange("purchaseSpec", "散称");
      result2.current.handleChange("purchaseUnit", "斤");
      result2.current.handleChange("stockUnit", "斤");
    });
    await act(async () => {
      await result2.current.submit();
    });
    await waitFor(() => expect(onSaved2).toHaveBeenCalledTimes(1));
    const postCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST"
    );
    const body2 = JSON.parse(String((postCalls[1]?.[1] as RequestInit).body));
    expect(body2.l2Code).toBeNull();
    expect(body2.l3Code).toBeNull();
  });
});
