/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SeasoningIngredientsPage from "@/app/ingredients/seasoning/page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockRouterReplace,
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => currentSearchParams,
  usePathname: () => "/ingredients/seasoning",
}));

const mockRouterReplace = jest.fn();

let currentSearchParams = new URLSearchParams();

const categories = [
  {
    code: "MEA",
    name: "肉类",
    children: [{ code: "MEA-POR", name: "猪肉", parentCode: "MEA" }],
  },
];

const units = [{ id: 1, name: "斤", category: "重量" }];

const rawRows = [
  {
    id: 1,
    code: "SEA-0001",
    name: "生抽",
    alias: "海天金标",
    purchaseSpec: "500ml/瓶",
    purchaseUnit: "瓶",
    stockUnit: "斤",
    unitsPerPurchase: 1,
    latestRefPrice: 8.5,
    pricePerJin: 8.5,
    defaultSupplierId: null,
  },
  {
    id: 2,
    code: "SEA-0002",
    name: "十三香",
    alias: null,
    purchaseSpec: "45g/盒",
    purchaseUnit: "盒",
    stockUnit: "斤",
    unitsPerPurchase: 1,
    latestRefPrice: 6.2,
    pricePerJin: 69,
    defaultSupplierId: null,
  },
];

const productRows = [
  {
    id: 50,
    code: "SP-0001",
    name: "蒸鱼双椒酱•1200g",
    productType: "单品调料",
    sourceMode: "transform",
    packageSpec: 1200,
    portion: "单人份",
    yieldRate: 80,
    unitPrice: 12.5,
    processingFeePerJin: null,
    grossMarginRate: 0,
    outPricePerJin: 12.5,
    standardPackagePrice: 30,
    brand: null,
    purchaseSpec: null,
    purchaseUnit: null,
    latestRefPrice: null,
    pricePerJin: null,
    sourceIngredient: { id: 7, name: "蒸鱼双椒酱", purchaseSpec: null, pricePerJin: 10 },
    defaultSupplier: null,
  },
];

beforeEach(() => {
  currentSearchParams = new URLSearchParams();
  mockRouterReplace.mockClear();
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/ingredient-categories")) {
      return { ok: true, json: async () => ({ data: categories }) } as Response;
    }
    if (url.includes("/api/units")) {
      return { ok: true, json: async () => ({ data: units }) } as Response;
    }
    if (url.includes("/api/ingredients?")) {
      return {
        ok: true,
        json: async () => ({
          data: rawRows,
          pagination: { totalItems: 2, totalPages: 1, page: 1, pageSize: 20 },
        }),
      } as Response;
    }
    if (url.includes("/api/seasoning-products?")) {
      return {
        ok: true,
        json: async () => ({
          data: productRows,
          pagination: { totalItems: 1, totalPages: 1, page: 1, pageSize: 20 },
        }),
      } as Response;
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as jest.MockedFunction<typeof fetch>;
});

function rawListRequests() {
  return (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/ingredients?"));
}

function productListRequests() {
  return (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/seasoning-products?"));
}

describe("调味品清单", () => {
  it("默认进入调味品 Tab：原料层列表，kind=seasoning 且不带分类/类型过滤", async () => {
    render(<SeasoningIngredientsPage />);

    expect(screen.getByRole("heading", { name: "调味品" })).toBeInTheDocument();
    for (const label of ["调味品", "单品调料", "复合调料", "成品酱料"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("tab", { name: "调味品" })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("新增调味品")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("生抽")).toBeInTheDocument());
    expect(screen.getByText("十三香")).toBeInTheDocument();
    expect(screen.getByText("共 2 条")).toBeInTheDocument();

    await waitFor(() => expect(rawListRequests().length).toBeGreaterThan(0));
    expect(
      rawListRequests().every(
        (u) =>
          u.includes("kind=seasoning") &&
          !u.includes("l2Code") &&
          !u.includes("seasoningType")
      )
    ).toBe(true);
  });

  it.each([
    ["item", "单品调料"],
    ["compound", "复合调料"],
    ["sauce", "成品酱料"],
  ] as const)(
    "tab=%s 产物层按 productType「%s」请求",
    async (tab, productType) => {
      currentSearchParams = new URLSearchParams(`tab=${tab}`);
      render(<SeasoningIngredientsPage />);

      expect(
        screen.getByRole("tab", { name: productType })
      ).toHaveAttribute("aria-selected", "true");

      await waitFor(() =>
        expect(productListRequests().length).toBeGreaterThan(0)
      );
      expect(
        productListRequests().some((u) =>
          u.includes(`productType=${encodeURIComponent(productType)}`)
        )
      ).toBe(true);
      // 产物层不请求原料列表
      expect(rawListRequests().length).toBe(0);
    }
  );

  it("产物 Tab 展示产物行（规格/出库价/来源）", async () => {
    currentSearchParams = new URLSearchParams("tab=item");
    render(<SeasoningIngredientsPage />);

    await waitFor(() =>
      expect(screen.getByText("蒸鱼双椒酱•1200g")).toBeInTheDocument()
    );
    expect(screen.getByText("1200g")).toBeInTheDocument();
    expect(screen.getByText("转化 · 蒸鱼双椒酱")).toBeInTheDocument();
  });

  it("点击页签会更新 URL", async () => {
    render(<SeasoningIngredientsPage />);
    await screen.findByText("生抽");

    fireEvent.click(screen.getByRole("tab", { name: "成品酱料" }));
    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/ingredients/seasoning?tab=sauce"
    );
  });
});
