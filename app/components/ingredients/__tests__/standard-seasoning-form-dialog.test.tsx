/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StandardSeasoningFormDialog } from "../standard-seasoning-form-dialog";

jest.setTimeout(15_000);

const source = {
  id: 7,
  code: "SEA-0006",
  name: "蒸鱼双椒酱",
  purchaseSpec: "1.2kg/瓶",
  pricePerJin: 10,
  l2Name: "固体类",
};

/** Radix 弹窗渲染在 portal 中，输入框要从 document.body 里取 */
function numberInputs(): HTMLInputElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLInputElement>('input[type="number"]')
  );
}

/** 取保存（POST）的调用；弹窗打开时会先发一次「已有数量」查询 */
function saveCall(mock: jest.Mock): [string, RequestInit] | undefined {
  return mock.mock.calls.find(
    (call) => (call[1] as RequestInit | undefined)?.method === "POST"
  ) as [string, RequestInit] | undefined;
}

describe("转调料弹窗", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ data: { id: 3, code: "SEA-SP-0001" } }),
        } as Response;
      }
      if (url.includes("/api/standard-seasonings?")) {
        return {
          ok: true,
          json: async () => ({
            data: [],
            pagination: { page: 1, pageSize: 1, totalItems: 2, totalPages: 2 },
          }),
        } as Response;
      }
      if (url.includes("/api/portion-profiles")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { portion: "单人份", scenario: "单人份", multiplier: 1, isBase: true, isActive: true, sortOrder: 0 },
              { portion: "小碗菜·10份", scenario: "团餐食堂", multiplier: 10, isBase: false, isActive: true, sortOrder: 1 },
            ],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    }) as unknown as jest.Mock;
    global.fetch = fetchMock;
  });

  it("头部展示来源调味品摘要，名称默认取调味品名", () => {
    render(
      <StandardSeasoningFormDialog
        open
        onOpenChange={() => {}}
        source={source}
      />
    );

    expect(screen.getByText("转化为调料清单")).toBeTruthy();
    expect(screen.getByText("SEA-0006")).toBeTruthy();
    expect(screen.getByText("蒸鱼双椒酱")).toBeTruthy();
    expect(screen.getByText("采购规格 1.2kg/瓶")).toBeTruthy();
    // 名称沿用来源调味品名，不拼规格后缀
    expect(
      (screen.getByDisplayValue("蒸鱼双椒酱") as HTMLInputElement).value
    ).toBe("蒸鱼双椒酱");
  });

  it("提供「查看已有调料清单」入口并显示已有数量", async () => {
    const onViewExisting = jest.fn();
    render(
      <StandardSeasoningFormDialog
        open
        onOpenChange={() => {}}
        source={source}
        onViewExisting={onViewExisting}
      />
    );

    const button = await screen.findByRole("button", {
      name: /查看已有调料清单/,
    });
    await waitFor(() => {
      expect(screen.getByText(/查看已有调料清单（2）/)).toBeTruthy();
    });
    fireEvent.click(button);
    expect(onViewExisting).toHaveBeenCalled();
  });

  it("份量默认取份量档案中倍率=10 的首个启用行", () => {
    render(
      <StandardSeasoningFormDialog
        open
        onOpenChange={() => {}}
        source={source}
      />
    );

    expect(screen.getAllByText("小碗菜·10份").length).toBeGreaterThan(0);
  });

  it("价格链路按来源调料每斤单价与出成率实时派生", () => {
    render(
      <StandardSeasoningFormDialog
        open
        onOpenChange={() => {}}
        source={source}
      />
    );

    const inputs = numberInputs();
    // 第一个数字输入是包装规格（g）
    fireEvent.change(inputs[0], { target: { value: "1200" } });
    // 出成率设为 80 → 单价 = 10 ÷ 0.8 = 12.5 → 标准规格价 = 12.5 × 1200 ÷ 500 = 30
    fireEvent.change(inputs[1], { target: { value: "80" } });

    expect(screen.getByText("¥30.00")).toBeTruthy();
  });

  it("保存时提交标准化规格口径的载荷", async () => {
    const onSuccess = jest.fn();
    render(
      <StandardSeasoningFormDialog
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
    expect(url).toBe("/api/standard-seasonings");
    expect(init.method).toBe("POST");
    const payload = JSON.parse(String(init.body));
    expect(payload).toEqual({
      name: "蒸鱼双椒酱",
      sourceIngredientId: 7,
      packageSpec: 1200,
      portion: "小碗菜·10份",
      yieldRate: 100,
      processingFeePerJin: null,
      grossMarginRate: 0,
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(3));
  });

  it("缺包装规格时给出可读校验提示且不提交", async () => {
    render(
      <StandardSeasoningFormDialog
        open
        onOpenChange={() => {}}
        source={source}
      />
    );

    fireEvent.click(screen.getByText("保存"));

    await waitFor(() => {
      expect(screen.getByText("请填写包装规格（g）")).toBeTruthy();
    });
    expect(saveCall(fetchMock)).toBeUndefined();
  });
});
