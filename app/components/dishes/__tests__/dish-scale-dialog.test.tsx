/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DishScaleDialog } from "../dish-scale-dialog";
import type { DishDetail } from "@/app/components/dish-form/types";
import type { DishScalePlan } from "@/lib/shared/dish-scale";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const dish = {
  id: 1,
  code: "DSH-HOT-0001",
  name: "宫保鸡丁",
  portion: "小碗菜",
  cost: 12,
  price: 18,
  status: "published",
} as unknown as DishDetail;

const plan: DishScalePlan = {
  factor: 10,
  targetPortion: "小碗菜·10份",
  net: [
    {
      kind: "net",
      sourceNetIngId: 101,
      sourceName: "鸡丁",
      sourceCode: "PRD-0101",
      sourcePortion: "小碗菜",
      sourcePackageSpec: 100,
      l2Code: "MEA-CHK",
      sourceIngredientId: 11,
      sourceIngredientName: "鸡肉",
      sourceIngredientPricePerJin: 20,
      packageMaterial: "密封袋",
      packageSize: "50cm×40cm",
      storage: "冷藏",
      canCreate: true,
      status: "existing",
      existing: {
        id: 201,
        code: "PRD-0201",
        name: "鸡丁",
        packageSpec: 1000,
        portion: "小碗菜·10份",
      },
      proposal: {
        name: "鸡丁",
        packageSpec: 1000,
        yieldRate: 65,
        processingFeePerJin: 2,
        grossMarginRate: 30,
        portion: "小碗菜·10份",
      },
    },
  ],
  minor: [
    {
      kind: "minor",
      sourceNetIngId: 102,
      sourceName: "葱花•20g",
      sourceCode: "PRD-0102",
      sourcePortion: "小碗菜",
      sourcePackageSpec: 20,
      l2Code: "MIN-VEG",
      sourceIngredientId: 12,
      sourceIngredientName: "小葱",
      sourceIngredientPricePerJin: 8,
      packageMaterial: "密封袋",
      packageSize: "50cm×40cm",
      storage: "冷藏",
      canCreate: true,
      status: "missing",
      proposal: {
        name: "葱花•200g",
        packageSpec: 200,
        yieldRate: 80,
        processingFeePerJin: null,
        grossMarginRate: null,
        portion: "小碗菜·10份",
      },
    },
  ],
};

function mockFetch() {
  const fetchMock = jest.fn().mockImplementation(async (url: string) => {
    if (url.includes("/scale/preview")) {
      return { ok: true, json: async () => ({ success: true, data: plan }) };
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 2, code: "DSH-HOT-0002", name: "宫保鸡丁·社区·3份" },
      }),
    };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("菜品转化弹窗", () => {
  it("展示已存在与待创建规格，待创建项可编辑并提交", async () => {
    const fetchMock = mockFetch();
    const onSuccess = jest.fn();

    render(
      <DishScaleDialog
        dish={dish}
        open
        onOpenChange={jest.fn()}
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => expect(screen.getByText("已存在")).toBeInTheDocument());
    expect(screen.getByText("待创建")).toBeInTheDocument();
    expect(screen.getByDisplayValue("200")).toBeInTheDocument();
    const nameInput = screen.getByDisplayValue("葱花•200g");

    fireEvent.change(screen.getByDisplayValue("200"), {
      target: { value: "300" },
    });
    expect(nameInput).toHaveValue("葱花•300g");

    fireEvent.click(screen.getByText("确认转化"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const scaleCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/scale")
    );
    expect(scaleCall).toBeTruthy();
    const body = JSON.parse(scaleCall![1].body as string);
    expect(body.portion).toBe("小碗菜·10份");
    expect(body.specs).toEqual([
      expect.objectContaining({
        kind: "minor",
        sourceNetIngId: 102,
        name: "葱花•300g",
        packageSpec: 300,
        yieldRate: 80,
      }),
    ]);
  });
});
