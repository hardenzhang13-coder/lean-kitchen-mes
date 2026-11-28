/** @jest-environment jsdom */

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  CategoryCascadeSelect,
  type CascadeCategory,
} from "../category-cascade-select";

const TREE: CascadeCategory[] = [
  {
    code: "VEG",
    name: "蔬菜",
    children: [
      {
        code: "VEG-LEF",
        name: "叶菜",
        children: [
          { code: "VEG-LEF-SHQ", name: "上海青" },
          { code: "VEG-LEF-SC", name: "生菜" },
        ],
      },
      { code: "VEG-MEL", name: "瓜果", children: [] },
    ],
  },
  {
    code: "MEA",
    name: "畜肉",
    children: [
      {
        code: "MEA-POR",
        name: "猪肉",
        children: [{ code: "MEA-POR-BEL", name: "五花肉" }],
      },
    ],
  },
];

function Harness({
  initial = { l1: "", l2: "", l3: "" },
  onChange,
}: {
  initial?: { l1: string; l2: string; l3: string };
  onChange?: (l1: string, l2: string, l3: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CategoryCascadeSelect
      categories={TREE}
      l1Code={value.l1}
      l2Code={value.l2}
      l3Code={value.l3}
      onChange={(l1, l2, l3) => {
        setValue({ l1, l2, l3 });
        onChange?.(l1, l2, l3);
      }}
      placeholder="请选择分类"
    />
  );
}

function openDialog() {
  fireEvent.click(screen.getByRole("combobox"));
}

describe("CategoryCascadeSelect 三级级联", () => {
  it("选中三级后确定，回传三级编码并显示完整路径", () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /^蔬菜/ }));
    fireEvent.click(screen.getByRole("button", { name: /^叶菜/ }));
    fireEvent.click(screen.getByRole("button", { name: "上海青" }));
    fireEvent.click(screen.getByRole("button", { name: "确定" }));

    expect(onChange).toHaveBeenCalledWith("VEG", "VEG-LEF", "VEG-LEF-SHQ");
    expect(screen.getByText("蔬菜 / 叶菜 / 上海青")).toBeInTheDocument();
  });

  it("「不限三级」只选到二级", () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /^蔬菜/ }));
    fireEvent.click(screen.getByRole("button", { name: /^叶菜/ }));
    fireEvent.click(screen.getByRole("button", { name: "不限三级" }));
    fireEvent.click(screen.getByRole("button", { name: "确定" }));

    expect(onChange).toHaveBeenCalledWith("VEG", "VEG-LEF", "");
    expect(screen.getByText("蔬菜 / 叶菜")).toBeInTheDocument();
  });

  it("切换一级后清空已选二级、三级", () => {
    render(<Harness initial={{ l1: "VEG", l2: "VEG-LEF", l3: "VEG-LEF-SHQ" }} />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /^畜肉/ }));
    expect(screen.getByText("畜肉 / 未选择二级")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确定" })).toBeDisabled();
  });

  it("二级无三级子级时提示可直接确定", () => {
    render(<Harness />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /^蔬菜/ }));
    fireEvent.click(screen.getByRole("button", { name: /^瓜果/ }));
    expect(
      screen.getByText("该分类暂无三级分类，可直接确定")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确定" })).toBeEnabled();
  });

  it("取消不改动已提交值", () => {
    const onChange = jest.fn();
    render(
      <Harness
        initial={{ l1: "VEG", l2: "VEG-LEF", l3: "" }}
        onChange={onChange}
      />
    );
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: /^畜肉/ }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("蔬菜 / 叶菜")).toBeInTheDocument();
  });
});
