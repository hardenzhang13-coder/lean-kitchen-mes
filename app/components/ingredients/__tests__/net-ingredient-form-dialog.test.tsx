/** @jest-environment jsdom */

import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { NetIngredientFormDialog } from "../net-ingredient-form-dialog";

jest.setTimeout(15_000);

const categories = [
  {
    code: "VEG",
    name: "蔬菜",
    children: [{ code: "VEG-LEF", name: "叶菜" }],
  },
  {
    code: "MIN",
    name: "小料",
    children: [{ code: "MIN-PREP", name: "初加工小料" }],
  },
];

const rawIngredients = [
  {
    id: 11,
    code: "ING-0011",
    name: "平包菜",
    alias: null,
    l2Code: "VEG-LEF",
    purchaseSpec: "散称",
    purchaseUnit: "斤",
    latestRefPrice: 2,
    pricePerJin: 2,
  },
];

const netRows = [
  {
    id: 21,
    code: "PRD-0021",
    name: "平包菜•称重•500g",
    packageSpec: 500,
    packageMaterial: "密封袋",
    packageSize: "50cm×40cm",
    processingFeePerJin: 0.35,
    yieldRate: 85,
    unitPrice: 2.35,
    costPricePerJin: 2.7,
    outPricePerJin: 4.5,
    standardPackagePrice: 4.5,
    grossMarginRate: 40,
    unit: "g",
    sourceIngredientId: 11,
    l2Code: "VEG-LEF",
  },
];

describe("转净料与新增净料弹窗", () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            data: { ...netRows[0], id: 22 },
          }),
        } as Response;
      }
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
      if (url.includes("/api/net-ingredients?")) {
        return {
          ok: true,
          json: async () => ({
            data: netRows,
            pagination: {
              totalItems: 1,
              totalPages: 1,
            },
          }),
        } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("转净料展示来源摘要、三分组和分类参照列表", async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    render(
      <NetIngredientFormDialog
        open
        onOpenChange={jest.fn()}
        mode="convert"
        sourceIngredientId={11}
        categories={categories}
        rawIngredients={rawIngredients}
      />
    );

    expect(
      await screen.findByRole("heading", { name: "转净料" })
    ).toBeInTheDocument();
    expect(screen.getByText("ING-0011")).toBeInTheDocument();
    expect(screen.getByText("平包菜")).toBeInTheDocument();
    expect(screen.getByText("蔬菜")).toBeInTheDocument();
    expect(screen.getByText("叶菜")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "更换来源" })
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "规格指标" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "加工指标" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "价格指标" })
    ).toBeInTheDocument();
    expect(screen.getByText("净料名称")).toBeInTheDocument();
    expect(screen.getByText("包装规格（g）")).toBeInTheDocument();
    expect(screen.getByText("包装名称")).toBeInTheDocument();
    expect(screen.getByText("包装尺寸")).toBeInTheDocument();
    expect(screen.getByText("封装加工费（元/斤）")).toBeInTheDocument();
    expect(
      screen.queryByText("根据加工指标自动计算")
    ).not.toBeInTheDocument();
    const calculatedPlaceholders = screen.getAllByText("自动计算得出");
    expect(calculatedPlaceholders).toHaveLength(4);
    for (const value of calculatedPlaceholders) {
      expect(value).toHaveClass("font-normal", "text-muted-foreground");
      expect(value).not.toHaveClass("font-semibold", "text-primary");
    }

    const packagingHeading = screen.getByRole("heading", {
      name: "规格指标",
    });
    expect(
      packagingHeading.parentElement?.parentElement?.parentElement
    ).toHaveClass("lg:grid-cols-3");

    const existingButton = await screen.findByRole("button", {
      name: /查看已有净料/,
    });
    expect(existingButton).toHaveTextContent("查看已有净料（1）");
    fireEvent.click(existingButton);
    expect(
      await screen.findByRole("heading", {
        name: "该食材分类下已录入系统的净料",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "序号" })
    ).toBeInTheDocument();
    const standardPriceHeader = screen.getByRole("columnheader", {
      name: "标准规格价",
    });
    expect(standardPriceHeader).not.toHaveClass("text-primary");
    const tableRow = screen.getByText(netRows[0].name).closest("tr");
    expect(tableRow).toHaveClass("[&>td]:py-2");
    expect(screen.getByText("¥4.50/份")).toHaveClass(
      "font-semibold",
      "text-primary"
    );
    expect(
      screen.getByRole("button", { name: "关闭" })
    ).toHaveClass("bg-primary");
    expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("l2Code=VEG-LEF")
      );
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("sourceIngredientId=11")
    );

    fireEvent.pointerDown(
      document.querySelector('[data-slot="sheet-overlay"]') as HTMLElement
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: "该食材分类下已录入系统的净料",
        })
      ).not.toBeInTheDocument();
    });
  });

  it("新增净料从来源选择开始并提供更换入口", async () => {
    render(
      <NetIngredientFormDialog
        open
        onOpenChange={jest.fn()}
        mode="net"
        categories={categories}
        rawIngredients={rawIngredients}
      />
    );

    expect(
      await screen.findByRole("heading", { name: "新增净料" })
    ).toBeInTheDocument();
    expect(screen.getByText("未选择来源原料")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "选择来源原料" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "选择来源原料" })
    ).toHaveClass("bg-primary");

    fireEvent.click(
      screen.getByRole("button", { name: "选择来源原料" })
    );
    expect(
      await screen.findByRole("heading", { name: "选择来源原料" })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("搜索食材名称...")
    ).toBeInTheDocument();
    expect(screen.queryByText("全部一级分类")).not.toBeInTheDocument();
    expect(screen.queryByText("全部二级分类")).not.toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "食材名称" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "每斤单价" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "编号" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "商品名称" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "采购单位" })
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("table"))
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
    ).toEqual([
      "序号",
      "食材名称",
      "一级分类",
      "二级分类",
      "采购规格",
      "最新参照单价",
      "每斤单价",
    ]);

    fireEvent.pointerDown(
      document.querySelector('[data-slot="sheet-overlay"]') as HTMLElement
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "选择来源原料" })
      ).not.toBeInTheDocument();
    });
  });

  it("来源原料列表默认每页 10 条并对齐已有净料抽屉行密度", async () => {
    const manyIngredients = Array.from({ length: 12 }, (_, index) => ({
      ...rawIngredients[0],
      id: index + 101,
      code: `ING-${String(index + 101).padStart(4, "0")}`,
      name: `测试原料${index + 1}`,
    }));
    render(
      <NetIngredientFormDialog
        open
        onOpenChange={jest.fn()}
        mode="net"
        categories={categories}
        rawIngredients={manyIngredients}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "选择来源原料" })
    );
    await screen.findByRole("heading", { name: "选择来源原料" });

    const table = screen.getByRole("table");
    expect(table.closest('[data-slot="card"]')).toBeNull();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.queryByText(/第 1-10 条/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "每页显示条数" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /首页|尾页/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /上一页/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /下一页/ })
    ).toBeInTheDocument();
    expect(screen.getByText("测试原料1").closest("tr")).toHaveClass(
      "[&>td]:py-2"
    );
  });

  it("保存成功后关闭弹窗并通知父页面刷新", async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const onOpenChange = jest.fn();
    const onSuccess = jest.fn();
    render(
      <NetIngredientFormDialog
        open
        onOpenChange={onOpenChange}
        mode="convert"
        sourceIngredientId={11}
        categories={categories}
        rawIngredients={rawIngredients}
        onSuccess={onSuccess}
      />
    );

    const nameInput = await screen.findByPlaceholderText(
      "如 平包菜•称重•500g"
    );
    fireEvent.change(nameInput, {
      target: { value: "平包菜•称重•500g" },
    });
    fireEvent.change(screen.getByPlaceholderText("如 85"), {
      target: { value: "85" },
    });

    expect(await screen.findByText("¥2.35")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("密封袋").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    const postCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST"
    );
    const payload = JSON.parse(String(postCall?.[1]?.body));
    expect(payload).not.toHaveProperty("unitPrice");
    expect(payload).not.toHaveProperty("autoCalculate");
    expect(payload.grossMarginRate).toBe(0);
  });

  it("小料模式继续使用原布局", async () => {
    render(
      <NetIngredientFormDialog
        open
        onOpenChange={jest.fn()}
        mode="minor"
        categories={categories}
        rawIngredients={rawIngredients}
      />
    );

    expect(
      await screen.findByRole("heading", { name: "新增小料" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "小料信息" })
    ).toBeInTheDocument();
    expect(screen.queryByText("包装名称")).not.toBeInTheDocument();
  });
});
