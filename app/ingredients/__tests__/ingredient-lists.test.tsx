/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import IngredientFoodPage from "@/app/ingredients/food/page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockRouterReplace,
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => currentSearchParams,
  usePathname: () => "/ingredients/food",
}));

const mockRouterReplace = jest.fn();

let currentSearchParams = new URLSearchParams();

const categories = [
  {
    code: "VEG",
    name: "蔬菜",
    children: [{ code: "VEG-LEF", name: "叶菜", parentCode: "VEG" }],
  },
  {
    code: "MIN",
    name: "小料",
    children: [{ code: "MIN-PREP", name: "初加工小料", parentCode: "MIN" }],
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
  currentSearchParams = new URLSearchParams();
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/ingredient-categories")) {
      return { ok: true, json: async () => ({ data: categories }) } as Response;
    }
    if (url.includes("/api/units")) {
      return { ok: true, json: async () => ({ data: units }) } as Response;
    }
    if (url.includes("/api/net-ingredients?")) {
      return {
        ok: true,
        json: async () => ({
          data: netRows,
          pagination: { totalItems: 1, totalPages: 1, page: 1, pageSize: 20 },
        }),
      } as Response;
    }
    if (url.includes("/api/ingredients")) {
      return {
        ok: true,
        json: async () => ({
          data: rawRows,
          pagination: { totalItems: 42, totalPages: 3, page: 1, pageSize: 20 },
        }),
      } as Response;
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as jest.MockedFunction<typeof fetch>;
});

describe("原料库统一清单", () => {
  it("默认进入食材清单，展示原料表和批量导入入口", async () => {
    render(<IngredientFoodPage />);

    expect(
      screen.getByRole("heading", { name: "食材库" })
    ).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "食材" })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("批量导入")).toBeInTheDocument();
    expect(screen.getByText("新增原料")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "转化" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText("带皮五花肉")).toBeInTheDocument()
    );
    expect(await screen.findByRole("button", { name: "转化" })).toBeInTheDocument();
    expect(screen.getByText("共 42 条")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /转净料/ })).not.toBeInTheDocument();
  });

  it("tab 参数指向净料时展示净料清单和对应主操作", async () => {
    currentSearchParams = new URLSearchParams("tab=net");
    render(<IngredientFoodPage />);

    expect(
      screen.getByRole("tab", { name: "净料清单" })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("新增净料")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("青椒丝")).toBeInTheDocument());
    expect(screen.getByText("净料单价")).toBeInTheDocument();
    expect(screen.queryByText("份量")).not.toBeInTheDocument();
    expect(screen.queryByText("社区·2份")).not.toBeInTheDocument();
  });

  it("tab 参数指向小料时展示小料清单和对应主操作", async () => {
    currentSearchParams = new URLSearchParams("tab=minor");
    render(<IngredientFoodPage />);

    expect(
      screen.getByRole("tab", { name: "小料清单" })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("新增小料")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("青椒丝")).toBeInTheDocument());
    expect(screen.getByText("小料单价")).toBeInTheDocument();
  });

  it("点击页签会更新统一清单 URL", async () => {
    render(<IngredientFoodPage />);
    await screen.findByText("带皮五花肉");

    fireEvent.click(screen.getByRole("tab", { name: "小料清单" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/ingredients/food?tab=minor");
  });

  it("原料转化入口打开双目标弹窗，默认目标为净料", async () => {
    render(<IngredientFoodPage />);
    await screen.findByText("带皮五花肉");

    fireEvent.click(screen.getByRole("button", { name: "转化" }));
    expect(
      await screen.findByRole("heading", { name: "转化食材" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "净料" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "小料" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("ING-0001")).toBeInTheDocument();
    expect(screen.getByText("创建净料")).toBeInTheDocument();
  });
});
