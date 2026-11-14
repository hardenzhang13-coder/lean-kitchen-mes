/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { NetPackagingSelect } from "../net-packaging-select";

describe("净料包装字段", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
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
          {
            id: 2,
            name: "密封袋",
            size: "30cm×20cm",
            isActive: true,
          },
          {
            id: 3,
            name: "真空袋",
            size: "20cm×30cm",
            isActive: true,
          },
        ],
      }),
    } as Response) as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("拆分模式默认选择第一个可用包装并展示名称与尺寸字段", async () => {
    const onChange = jest.fn();
    render(
      <NetPackagingSelect
        variant="split"
        packageMaterial=""
        packageSize=""
        onChange={onChange}
      />
    );

    expect(screen.getByText("包装名称")).toBeInTheDocument();
    expect(screen.getByText("包装尺寸")).toBeInTheDocument();
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("密封袋", "50cm×40cm");
    });
  });
});
