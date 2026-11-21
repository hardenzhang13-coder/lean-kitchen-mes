/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RawIngredientsPage from "@/app/ingredients/raw/page";
import NetIngredientsPage from "@/app/ingredients/net/page";
import SeasoningIngredientsPage from "@/app/ingredients/seasoning/page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/ingredients/raw",
}));

const categories = [
  {
    code: "VEG",
    name: "蔬菜",
    children: [{ code: "VEG-LEF", name: "叶菜", parentCode: "VEG" }],
  },
];

const units = [{ id: 1, name: "斤", category: "重量" }];

const rawRows = [
  {
    id: 1,
    code: "ING-0001",
    name: "带皮五花肉",
    alias: "五花肉",
    l2Code: "VEG-LEF",
    purchaseSpec: "散称",
    purchaseUnit: "斤",
    latestRefPrice: 18.5,
    pricePerJin: 12.34,
    stockUnit: "斤",
    unitsPerPurchase: 1,
    defaultSupplierId: null,
  },
];

const netRows = [
  {
    id: 11,
    code: "PRD-0011",
    name: "青椒丝",
    packageSpec: 500,
    packageMaterial: "密封袋",
    packageSize: "50cm×40cm",
    processingFeePerJin: 0.35,
    yieldRate: 85,
    unitPrice: 2.35,
    grossMarginRate: 40,
    outPricePerJin: 4.5,
    standardPackagePrice: 4.5,
    sourceIngredientId: 1,
    l2Code: "VEG-LEF",
    portion: "社区·2份",
    sourceIngredient: { id: 1, name: "青椒" },
  },
];

beforeEach(() => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/ingredient-categories")) {
      return { ok: true, json: async () => ({ data: categories }) } as Response;
    }
    if (url.includes("/api/units")) {
      return { ok: true, json: async () => ({ data: units }) } as Response;
    }
    if (url.includes("/api/net-ingredients/")) {
      return { ok: true, json: async () => ({ data: netRows[0] }) } as Response;
    }
    if (url.includes("/api/net-ingredients")) {
      return {
        ok: true,
        json: async () => ({
          data: netRows,
          pagination: { totalItems: 1, totalPages: 1, page: 1, pageSize: 20 },
        }),
      } as Response;
    }
    if (url.includes("/api/ingredients/check-name")) {
      return { ok: true, json: async () => ({ exists: false }) } as Response;
    }
    if (url.includes("/api/ingredients/")) {
      return { ok: true, json: async () => ({ data: rawRows[0] }) } as Response;
    }
    return {
      ok: true,
      json: async () => ({
        data: rawRows,
        pagination: { totalItems: 42, totalPages: 3, page: 1, pageSize: 20 },
      }),
    } as Response;
  }) as jest.MockedFunction<typeof fetch>;
});

describe("食材清单页的底部组件与字段展示", () => {
  it("原料清单底部展示完整区间汇总与每页条数选择", async () => {
    render(<RawIngredientsPage />);

    await waitFor(() =>
      expect(
        screen.getByText("共 42 条 原料")
      ).toBeInTheDocument()
    );
    // 每页条数为胶囊触发器，文案「N 条/页」
    expect(screen.getByText(/\d+ 条\/页/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /下一页/ })).toBeInTheDocument();
  });

  it("最新参照单价不再带单位后缀，采购单位列仍存在", async () => {
    render(<RawIngredientsPage />);

    await waitFor(() => expect(screen.getByText("¥18.50")).toBeInTheDocument());
    expect(screen.queryByText("¥18.50/斤")).not.toBeInTheDocument();
    expect(screen.getByText("采购单位")).toBeInTheDocument();
    expect(screen.getAllByText("斤").length).toBeGreaterThan(0);
  });

  it("净料清单不展示份量列与份量标签", async () => {
    render(<NetIngredientsPage />);

    await waitFor(() =>
      expect(screen.getByText("青椒丝")).toBeInTheDocument()
    );

    expect(screen.queryByText("份量")).not.toBeInTheDocument();
    expect(screen.queryByText("社区·2份")).not.toBeInTheDocument();
  });
});

describe("食材清单页的列名、核心字段与复制能力", () => {
  it("原料清单使用「品牌名称」列名，并提供复制与删除", async () => {
    render(<RawIngredientsPage />);

    await waitFor(() =>
      expect(screen.getByText("带皮五花肉")).toBeInTheDocument()
    );
    expect(screen.getByText("品牌名称")).toBeInTheDocument();
    expect(screen.queryByText("商品名称")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /复制原料/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /删除原料/ })
    ).toBeInTheDocument();
  });

  it("列表工具栏的放大镜图标内嵌在搜索框内，不作为前置元素", async () => {
    render(<RawIngredientsPage />);

    await waitFor(() =>
      expect(screen.getByText("带皮五花肉")).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText("搜索名称...");
    const icon = input.parentElement?.querySelector("svg");
    expect(icon).not.toBeNull();
    // 内嵌图标用绝对定位覆盖在输入框左侧，不是输入框前的独立元素
    expect(icon).toHaveClass("absolute");
  });

  it("点击复制打开复制表单并回填来源档案内容", async () => {
    render(<RawIngredientsPage />);

    await waitFor(() =>
      expect(screen.getByText("带皮五花肉")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /复制原料/ }));

    await waitFor(() => expect(screen.getByText("复制原料")).toBeInTheDocument());
    const nameInput = document.getElementById(
      "ingredient-name"
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("带皮五花肉-副本");
  });

  it("调料清单重点显示食材名称与每斤单价", async () => {
    render(<SeasoningIngredientsPage />);

    await waitFor(() =>
      expect(screen.getByText("带皮五花肉")).toBeInTheDocument()
    );
    expect(screen.getByText("带皮五花肉").className).toContain("text-primary");
    expect(screen.getByText("¥12.34/斤").className).toContain("text-primary");
  });

  it("净料清单保留复制与删除操作", async () => {
    render(<NetIngredientsPage />);

    await waitFor(() =>
      expect(screen.getByText("青椒丝")).toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: /复制净料/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /删除净料/ })
    ).toBeInTheDocument();
  });

  it("编辑入口打开净料抽屉的编辑态", async () => {
    render(<NetIngredientsPage />);

    await waitFor(() =>
      expect(screen.getByText("青椒丝")).toBeInTheDocument()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "编辑净料 青椒丝" })
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /编辑净料/ })
      ).toBeInTheDocument()
    );
    expect(screen.getByText("保存")).toBeInTheDocument();
  });
});
