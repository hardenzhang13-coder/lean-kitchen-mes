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

describe("转调料弹窗", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: { id: 3, code: "SEA-SP-0001" } }),
    })) as unknown as jest.Mock;
    global.fetch = fetchMock;
  });

  it("头部展示来源调料摘要，名称默认取调料名", () => {
    render(
      <StandardSeasoningFormDialog
        open
        onOpenChange={() => {}}
        source={source}
      />
    );

    expect(screen.getByText("转调料")).toBeTruthy();
    expect(screen.getByText("SEA-0006")).toBeTruthy();
    expect(screen.getByText("蒸鱼双椒酱")).toBeTruthy();
    expect(screen.getByText("采购规格 1.2kg/瓶")).toBeTruthy();
    // 名称沿用来源调料名，不拼规格后缀
    expect(
      (screen.getByDisplayValue("蒸鱼双椒酱") as HTMLInputElement).value
    ).toBe("蒸鱼双椒酱");
  });

  it("份量默认来自净料/小料的同一套枚举", () => {
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
      expect(fetchMock).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
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

  it("缺包装规格时给出可读校验提示", async () => {
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
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
