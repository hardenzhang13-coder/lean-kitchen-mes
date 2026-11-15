/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { DetailSection, InfoCell } from "../detail-section";

describe("详情内容分组", () => {
  it("渲染分组标题与双列信息单元", () => {
    render(
      <DetailSection title="价格与成本">
        <InfoCell label="净料单价" value="¥3.56/斤" emphasis />
        <InfoCell label="毛利率" value="40%" />
      </DetailSection>
    );

    expect(screen.getByText("价格与成本")).toBeInTheDocument();
    expect(screen.getByText("净料单价")).toBeInTheDocument();
    expect(screen.getByText("¥3.56/斤")).toBeInTheDocument();
    expect(screen.getByText("毛利率")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("强调字段使用主题色加粗", () => {
    render(
      <DetailSection title="基础信息">
        <InfoCell label="名称" value="去骨鸡肉" emphasis />
      </DetailSection>
    );

    const value = screen.getByText("去骨鸡肉");
    expect(value).toHaveClass("text-primary", "font-semibold");
  });

  it("非强调字段使用常规前景色", () => {
    render(
      <DetailSection title="基础信息">
        <InfoCell label="编号" value="NL-0001" />
      </DetailSection>
    );

    expect(screen.getByText("NL-0001")).toHaveClass("font-medium");
    expect(screen.getByText("NL-0001")).not.toHaveClass("text-primary");
  });
});
