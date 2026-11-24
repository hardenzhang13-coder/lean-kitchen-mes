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
    code: "SEA",
    name: "调味品",
    children: [
      { code: "SEA-SOL", name: "固体类", parentCode: "SEA" },
      { code: "SEA-LIQ", name: "液体类", parentCode: "SEA" },
    ],
  },
];

const units = [{ id: 1, name: "斤", category: "重量" }];

const rows = [
  {
    id: 1,
    code: "SEA-0001",
    name: "生抽",
    alias: null,
    l2Code: "SEA-LIQ",
    seasoningType: "单品调料",
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
    l2Code: "SEA-SOL",
    seasoningType: "复合调料",
    purchaseSpec: "45g/盒",
    purchaseUnit: "盒",
    stockUnit: "斤",
    unitsPerPurchase: 1,
    latestRefPrice: 6.2,
    pricePerJin: 69,
    defaultSupplierId: null,
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
          data: rows,
          pagination: { totalItems: 2, totalPages: 1, page: 1, pageSize: 20 },
        }),
      } as Response;
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as jest.MockedFunction<typeof fetch>;
});

function ingredientListRequests() {
  return (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/ingredients?"));
}

describe("调味品清单", () => {
  it("默认进入调味品 Tab，展示四个页签与全部调味品", async () => {
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

    await waitFor(() =>
      expect(ingredientListRequests().length).toBeGreaterThan(0)
    );
    expect(
      ingredientListRequests().every(
        (u) => !u.includes("l2Code") && !u.includes("seasoningType")
      )
    ).toBe(true);
  });

  it.each([
    ["item", "单品调料"],
    ["compound", "复合调料"],
    ["sauce", "成品酱料"],
  ] as const)(
    "tab=%s 挂类型「%s」过滤",
    async (tab, seasoningType) => {
      currentSearchParams = new URLSearchParams(`tab=${tab}`);
      render(<SeasoningIngredientsPage />);

      expect(
        screen.getByRole("tab", { name: seasoningType })
      ).toHaveAttribute("aria-selected", "true");

      await waitFor(() => expect(ingredientListRequests().length).toBeGreaterThan(0));
      expect(
        ingredientListRequests().some((u) =>
          u.includes(`seasoningType=${encodeURIComponent(seasoningType)}`)
        )
      ).toBe(true);
    }
  );

  it("点击页签会更新 URL", async () => {
    render(<SeasoningIngredientsPage />);
    await screen.findByText("生抽");

    fireEvent.click(screen.getByRole("tab", { name: "成品酱料" }));
    expect(mockRouterReplace).toHaveBeenCalledWith(
      "/ingredients/seasoning?tab=sauce"
    );
  });
});
