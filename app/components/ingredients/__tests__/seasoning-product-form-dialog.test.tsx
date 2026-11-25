/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SeasoningProductFormDialog } from "../seasoning-product-form-dialog";

jest.setTimeout(15_000);

const source = {
  id: 7,
  code: "SEA-0006",
  name: "蒸鱼双椒酱",
  purchaseSpec: "1.2kg/瓶",
  pricePerJin: 10,
  seasoningType: "单品调料",
};

/** Radix 弹窗渲染在 portal 中，输入框要从 document.body 里取 */
function numberInputs(): HTMLInputElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLInputElement>('input[type="number"]')
  );
}

/** 取保存（POST/PUT）的调用；弹窗打开时会先发一次「已有数量」查询 */
function saveCall(mock: jest.Mock): [string, RequestInit] | undefined {
  return mock.mock.calls.find(
    (call) =>
      (call[1] as RequestInit | undefined)?.method === "POST" ||
      (call[1] as RequestInit | undefined)?.method === "PUT"
  ) as [string, RequestInit] | undefined;
}

describe("调料产物表单弹窗（纯转化口径）", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" || init?.method === "PUT") {
        return {
          ok: true,
          json: async () => ({ data: { id: 3, code: "SP-0001" } }),
        } as Response;
      }
      if (url.includes("/api/seasoning-products?")) {
        return {
          ok: true,
          json: async () => ({
            data: [],
            pagination: { page: 1, pageSize: 1, totalItems: 2, totalPages: 2 },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    }) as unknown as jest.Mock;
    global.fetch = fetchMock;
  });

  it("转化入口：标题按来源类型归档，头部展示来源摘要，包装规格默认 500g", () => {
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        source={source}
      />
    );

    expect(screen.getByText("转化为单品调料")).toBeTruthy();
    expect(screen.getByText("SEA-0006")).toBeTruthy();
    expect(screen.getByText("蒸鱼双椒酱")).toBeTruthy();
    expect(screen.getByText("采购规格 1.2kg/瓶")).toBeTruthy();
    // 名称沿用来源调味品名；包装规格默认 500g（用户口径：转化默认 500g）
    expect(
      (screen.getByDisplayValue("蒸鱼双椒酱") as HTMLInputElement).value
    ).toBe("蒸鱼双椒酱");
    const inputs = numberInputs();
    expect(inputs[0].value).toBe("500");
    // 产物类型/来源方式/来源调味品不再是表单字段
    expect(screen.queryByText("产物类型")).toBeNull();
    expect(screen.queryByText("来源方式")).toBeNull();
  });

  it("提供「查看已有产物」入口并显示已有数量", async () => {
    const onViewExisting = jest.fn();
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        source={source}
        onViewExisting={onViewExisting}
      />
    );

    const button = await screen.findByRole("button", {
      name: /查看已有产物/,
    });
    await waitFor(() => {
      expect(screen.getByText(/查看已有产物（2）/)).toBeTruthy();
    });
    fireEvent.click(button);
    expect(onViewExisting).toHaveBeenCalled();
  });

  it("价格链路按来源每斤单价与出成率实时派生", () => {
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        source={source}
      />
    );

    const inputs = numberInputs();
    // 第一个数字输入是包装规格（g），改为 1200；第二个是出成率 80
    fireEvent.change(inputs[0], { target: { value: "1200" } });
    fireEvent.change(inputs[1], { target: { value: "80" } });

    // 单价 = 10 ÷ 0.8 = 12.5 → 标准规格价 = 12.5 × 1200 ÷ 500 = 30
    expect(screen.getByText("¥30.00")).toBeTruthy();
  });

  it("保存时提交纯转化载荷（类型由服务端继承来源，不在载荷内）", async () => {
    const onSuccess = jest.fn();
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        source={source}
        onSuccess={onSuccess}
      />
    );

    const inputs = numberInputs();
    fireEvent.change(inputs[0], { target: { value: "1200" } });

    fireEvent.click(screen.getByText("保存"));

    await waitFor(() => {
      expect(saveCall(fetchMock)).toBeDefined();
    });
    const [url, init] = saveCall(fetchMock)!;
    expect(url).toBe("/api/seasoning-products");
    expect(init.method).toBe("POST");
    const payload = JSON.parse(String(init.body));
    expect(payload).toEqual({
      name: "蒸鱼双椒酱",
      sourceIngredientId: 7,
      packageSpec: 1200,
      yieldRate: 100,
      processingFeePerJin: null,
      grossMarginRate: 0,
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(3));
  });

  it("缺包装规格时给出可读校验提示且不提交", async () => {
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        source={source}
      />
    );

    const inputs = numberInputs();
    fireEvent.change(inputs[0], { target: { value: "" } });
    fireEvent.click(screen.getByText("保存"));

    await waitFor(() => {
      expect(screen.getByText("请填写包装规格（g）")).toBeTruthy();
    });
    expect(saveCall(fetchMock)).toBeUndefined();
  });

  it("编辑态：标题沿用产物类型，PUT 到对应产物", async () => {
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        source={source}
        initialData={{
          id: 3,
          code: "SP-0001",
          name: "蒸鱼双椒酱·小袋",
          productType: "单品调料",
          packageSpec: 200,
          yieldRate: 100,
          processingFeePerJin: null,
          grossMarginRate: 0,
        }}
      />
    );

    expect(screen.getByText("编辑单品调料")).toBeTruthy();
    const inputs = numberInputs();
    expect(inputs[0].value).toBe("200");

    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => {
      expect(saveCall(fetchMock)).toBeDefined();
    });
    const [url, init] = saveCall(fetchMock)!;
    expect(url).toBe("/api/seasoning-products/3");
    expect(init.method).toBe("PUT");
  });
});
