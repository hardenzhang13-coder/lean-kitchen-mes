/** @jest-environment jsdom */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { IngredientDetailSheet } from "../ingredient-detail-sheet";

jest.setTimeout(15_000);

const rawDetail = {
  id: 11,
  code: "ING-0011",
  name: "带皮五花肉",
  alias: "双汇",
  l2Code: "MEA-POR",
  purchaseSpec: "散称",
  purchaseUnit: "斤",
  stockUnit: "斤",
  defaultSupplierId: 7,
  defaultSupplier: { id: 7, name: "京鲜肉联配送中心" },
  latestRefPrice: 18.5,
  pricePerJin: 18.5,
};

const netDetail = {
  id: 21,
  code: "PRD-0021",
  name: "平包菜•称重•500g",
  l2Code: "VEG-LEF",
  sourceIngredientId: 11,
  sourceIngredient: { id: 11, name: "平包菜", pricePerJin: 2 },
  packageSpec: 500,
  packageMaterial: "密封袋",
  packageSize: "50cm×40cm",
  processingFeePerJin: 0.35,
  yieldRate: 85,
  unitPrice: 2.35,
  grossMarginRate: 40,
  costPricePerJin: 2.7,
  outPricePerJin: 4.5,
  standardPackagePrice: 4.5,
};

describe("原料详情抽屉", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: rawDetail }),
    } as Response) as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("查看态点击编辑后在同一抽屉切换，取消后恢复只读", async () => {
    render(
      <IngredientDetailSheet
        open
        onOpenChange={jest.fn()}
        kind="raw"
        ingredientId={11}
        categories={[
          {
            code: "MEA",
            name: "肉类",
            children: [{ code: "MEA-POR", name: "猪肉" }],
          },
        ]}
        units={[
          { id: 1, name: "斤", category: "weight" },
          { id: 2, name: "公斤", category: "weight" },
        ]}
        inlineEdit
        onConvert={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const detailHeading = await screen.findByRole("heading", {
      name: "原料详情",
    });
    expect(detailHeading).toBeInTheDocument();
    const coreName = await screen.findByText("带皮五花肉");
    expect(coreName).toHaveClass("font-semibold", "text-primary");
    const numericValues = screen.getAllByText("18.5");
    expect(numericValues).toHaveLength(2);
    for (const value of numericValues) {
      expect(value).toHaveClass("font-semibold", "tabular-nums");
    }
    await waitFor(() => {
      expect(detailHeading.nextElementSibling).toHaveTextContent(
        "ING-0011·肉类·猪肉"
      );
      expect(detailHeading.nextElementSibling).not.toHaveTextContent("编号");
      expect(detailHeading.nextElementSibling).not.toHaveTextContent(
        "一级分类"
      );
      expect(detailHeading.nextElementSibling).not.toHaveTextContent(
        "二级分类"
      );
    });

    const deleteButton = screen.getByRole("button", { name: /删除/ });
    const editButton = screen.getByRole("button", { name: "编辑" });
    const convertButton = screen.getByRole("button", { name: "转净料" });
    expect(
      deleteButton.compareDocumentPosition(editButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(
      editButton.compareDocumentPosition(convertButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);

    fireEvent.click(editButton);

    expect(
      screen.getByRole("heading", { name: "编辑原料" })
    ).toBeInTheDocument();
    expect(await screen.findByDisplayValue("带皮五花肉")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    const basicHeading = screen.getByRole("heading", { name: "基础信息" });
    expect(basicHeading.parentElement?.nextElementSibling).toHaveClass(
      "xl:grid-cols-3"
    );

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "原料详情" })
      ).toBeInTheDocument();
    });
    expect(await screen.findByText("带皮五花肉")).toHaveClass(
      "font-semibold",
      "text-primary"
    );
  });

  it("编辑入口打开抽屉时直接进入可编辑态", async () => {
    render(
      <IngredientDetailSheet
        open
        onOpenChange={jest.fn()}
        kind="raw"
        ingredientId={11}
        categories={[
          {
            code: "MEA",
            name: "肉类",
            children: [{ code: "MEA-POR", name: "猪肉" }],
          },
        ]}
        units={[{ id: 1, name: "斤", category: "weight" }]}
        inlineEdit
        startInEditMode
      />
    );

    expect(
      await screen.findByRole("heading", { name: "编辑原料" })
    ).toBeInTheDocument();
    expect(await screen.findByDisplayValue("带皮五花肉")).not.toBeDisabled();
  });

  it("保存成功后刷新详情并回到只读态", async () => {
    const onUpdated = jest.fn();
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    let saved = false;
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/check-name")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ exists: false }),
        } as Response;
      }
      if (url.includes("/api/suppliers")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Response;
      }
      if (init?.method === "PUT") {
        saved = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: { ...rawDetail, name: "精选五花肉" },
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: saved ? { ...rawDetail, name: "精选五花肉" } : rawDetail,
        }),
      } as Response;
    });

    render(
      <IngredientDetailSheet
        open
        onOpenChange={jest.fn()}
        kind="raw"
        ingredientId={11}
        categories={[
          {
            code: "MEA",
            name: "肉类",
            children: [{ code: "MEA-POR", name: "猪肉" }],
          },
        ]}
        units={[{ id: 1, name: "斤", category: "weight" }]}
        inlineEdit
        startInEditMode
        onUpdated={onUpdated}
      />
    );

    const nameInput = await screen.findByDisplayValue("带皮五花肉");
    fireEvent.change(nameInput, { target: { value: "精选五花肉" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole("heading", { name: "原料详情" })
      ).toBeInTheDocument();
    });
    expect(await screen.findByText("精选五花肉")).toHaveClass(
      "font-semibold",
      "text-primary"
    );
  });
});

describe("净料详情抽屉", () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/net-packagings")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 1,
                name: "密封袋",
                size: "50cm×40cm",
                isActive: true,
              },
            ],
          }),
        } as Response;
      }
      if (init?.method === "PUT") {
        return {
          ok: true,
          json: async () => ({ data: netDetail }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ data: netDetail }),
      } as Response;
    }) as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("查看态按三分组展示，并在同一抽屉切换到三列编辑态", async () => {
    render(
      <IngredientDetailSheet
        open
        onOpenChange={jest.fn()}
        kind="net"
        ingredientId={21}
        categories={[
          {
            code: "VEG",
            name: "蔬菜",
            children: [{ code: "VEG-LEF", name: "叶菜" }],
          },
        ]}
        rawIngredients={[]}
        inlineEdit
        onPrintLabel={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(
      await screen.findByRole("heading", { name: "净料详情" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "规格指标" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "加工指标" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "价格指标" })
    ).toBeInTheDocument();
    expect(screen.getByText("PRD-0021")).toBeInTheDocument();
    expect(screen.getByText("平包菜")).toBeInTheDocument();
    const standardPrices = await screen.findAllByText("¥4.50");
    expect(
      standardPrices.some(
        (value) =>
          value.classList.contains("font-semibold") &&
          value.classList.contains("tabular-nums") &&
          value.classList.contains("text-primary")
      )
    ).toBe(true);

    const editButton = screen.getByRole("button", { name: "编辑" });
    const printButton = screen.getByRole("button", { name: "打印标签" });
    const deleteButton = screen.getByRole("button", { name: /删除/ });
    expect(printButton).toHaveClass("bg-primary");
    expect(editButton).not.toHaveClass("bg-primary");
    expect(
      deleteButton.compareDocumentPosition(editButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(
      editButton.compareDocumentPosition(printButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    fireEvent.click(editButton);

    expect(
      screen.getByRole("heading", { name: "编辑净料" })
    ).toBeInTheDocument();
    expect(
      await screen.findByDisplayValue("平包菜•称重•500g")
    ).not.toBeDisabled();
    const specHeading = screen.getByRole("heading", { name: "规格指标" });
    expect(specHeading.parentElement?.nextElementSibling).toHaveClass(
      "xl:grid-cols-3"
    );

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "净料详情" })
      ).toBeInTheDocument();
    });
  });

  it("列表编辑入口直接进入同一抽屉编辑态，保存后回到只读态", async () => {
    const onUpdated = jest.fn();
    render(
      <IngredientDetailSheet
        open
        onOpenChange={jest.fn()}
        kind="net"
        ingredientId={21}
        categories={[
          {
            code: "VEG",
            name: "蔬菜",
            children: [{ code: "VEG-LEF", name: "叶菜" }],
          },
        ]}
        rawIngredients={[]}
        inlineEdit
        startInEditMode
        onUpdated={onUpdated}
      />
    );

    expect(
      await screen.findByRole("heading", { name: "编辑净料" })
    ).toBeInTheDocument();
    const nameInput = await screen.findByDisplayValue(
      "平包菜•称重•500g"
    );
    fireEvent.change(nameInput, {
      target: { value: "平包菜•称重•500g（新版）" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole("heading", { name: "净料详情" })
      ).toBeInTheDocument();
    });
  });

  it("修改出成率后净料单价和三项价格指标实时联动", async () => {
    render(
      <IngredientDetailSheet
        open
        onOpenChange={jest.fn()}
        kind="net"
        ingredientId={21}
        categories={[
          {
            code: "VEG",
            name: "蔬菜",
            children: [{ code: "VEG-LEF", name: "叶菜" }],
          },
        ]}
        rawIngredients={[]}
        inlineEdit
        startInEditMode
      />
    );

    const yieldInput = await screen.findByDisplayValue("85");
    fireEvent.change(yieldInput, { target: { value: "100" } });

    await waitFor(() => {
      expect(screen.getByText("¥2.00")).toBeInTheDocument();
      expect(screen.getByText("¥2.35")).toBeInTheDocument();
      expect(screen.getAllByText("¥3.92").length).toBeGreaterThanOrEqual(2);
    });
  });
});
