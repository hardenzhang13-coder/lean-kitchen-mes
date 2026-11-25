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

describe("调料产物表单弹窗", () => {
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

  it("转化入口：头部展示来源摘要、来源方式锁定转化、包装规格默认 500g", () => {
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

  it("份量默认取份量档案中倍率=10 的首个启用行（单人份口径）", async () => {
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        source={source}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("小碗菜·10份").length).toBeGreaterThan(0);
    });
  });

  it("转化口径价格链路按来源每斤单价与出成率实时派生", async () => {
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        source={source}
      />
    );

    // 等份量档案返回触发的表单重建完成，避免默认值重置覆盖后续输入
    await screen.findByText("小碗菜·10份");
    const inputs = numberInputs();
    // 第一个数字输入是包装规格（g），改为 1200；第二个是出成率 80
    fireEvent.change(inputs[0], { target: { value: "1200" } });
    fireEvent.change(inputs[1], { target: { value: "80" } });

    // 单价 = 10 ÷ 0.8 = 12.5 → 标准规格价 = 12.5 × 1200 ÷ 500 = 30
    expect(screen.getByText("¥30.00")).toBeTruthy();
  });

  it("保存时提交转化口径载荷（不含外购字段）", async () => {
    const onSuccess = jest.fn();
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        source={source}
        onSuccess={onSuccess}
      />
    );

    await screen.findByText("小碗菜·10份");
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
      productType: "单品调料",
      sourceMode: "transform",
      packageSpec: 1200,
      portion: "小碗菜·10份",
      processingFeePerJin: null,
      grossMarginRate: 0,
      sourceIngredientId: 7,
      yieldRate: 100,
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

  it("产物页直建（无来源锁定）：可切外购口径，每斤单价必填", async () => {
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        fixedProductType="成品酱料"
      />
    );

    expect(screen.getByText("新增成品酱料")).toBeTruthy();
    // 无来源锁定：展示来源选择下拉（调味品原料清单）
    await screen.findByText("选择来源调味品");
    // 等份量档案触发的表单重建完成，避免默认值重置还原来源方式
    await screen.findByText("小碗菜·10份");

    // 切到外购：打开来源方式下拉（Base UI combobox）并选择「外购」
    const modeTrigger = screen
      .getAllByRole("combobox")
      .find((el) => el.textContent?.includes("转化"));
    expect(modeTrigger).toBeTruthy();
    fireEvent.click(modeTrigger as HTMLElement);
    const option = await screen.findByRole("option", { name: "外购" });
    fireEvent.pointerDown(option, { pointerType: "mouse" });
    fireEvent.click(option);
    await waitFor(() => {
      expect(screen.getByText("外购信息")).toBeTruthy();
    });
    expect(screen.queryByText("选择来源调味品")).not.toBeInTheDocument();

    // 不填每斤单价直接保存 → 校验拦截
    const nameInput = (await screen.findAllByDisplayValue("")).find(
      (el) => el.tagName === "INPUT"
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "成品叉烧酱" } });
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => {
      expect(screen.getByText("外购口径必须填写每斤单价")).toBeTruthy();
    });
    expect(saveCall(fetchMock)).toBeUndefined();
  });

  it("外购口径保存提交手填每斤单价，不写来源与出成率", async () => {
    render(
      <SeasoningProductFormDialog
        open
        onOpenChange={() => {}}
        fixedProductType="成品酱料"
      />
    );

    // 等份量档案触发的表单重建完成，避免默认值重置覆盖输入
    await screen.findByText("小碗菜·10份");
    const modeTrigger = screen
      .getAllByRole("combobox")
      .find((el) => el.textContent?.includes("转化"));
    fireEvent.click(modeTrigger as HTMLElement);
    const option = await screen.findByRole("option", { name: "外购" });
    fireEvent.pointerDown(option, { pointerType: "mouse" });
    fireEvent.click(option);
    const nameInput = (await screen.findAllByDisplayValue("")).find(
      (el) => el.tagName === "INPUT"
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "成品叉烧酱" } });
    fireEvent.change(screen.getByPlaceholderText("如 9.6"), {
      target: { value: "9.6" },
    });
    fireEvent.click(screen.getByText("保存"));

    await waitFor(() => {
      expect(saveCall(fetchMock)).toBeDefined();
    });
    const [url, init] = saveCall(fetchMock)!;
    expect(url).toBe("/api/seasoning-products");
    const payload = JSON.parse(String(init.body));
    expect(payload).toEqual({
      name: "成品叉烧酱",
      productType: "成品酱料",
      sourceMode: "purchase",
      packageSpec: 500,
      portion: "小碗菜·10份",
      processingFeePerJin: null,
      grossMarginRate: 0,
      brand: null,
      purchaseSpec: null,
      purchaseUnit: null,
      latestRefPrice: null,
      pricePerJin: 9.6,
    });
  });
});
