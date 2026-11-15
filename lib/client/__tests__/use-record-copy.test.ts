/** @jest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { useRecordCopy } from "../use-record-copy";

type Record1 = { name: string; l2Code: string };
type FormData = { name?: string | null; l2Code?: string | null };

describe("档案复制编排", () => {
  it("打开复制时回填档案并给名称追加「-副本」", () => {
    const { result } = renderHook(() =>
      useRecordCopy<Record1, FormData>({
        buildInitialData: (row) => ({ l2Code: row.l2Code }),
        title: "复制原料",
      })
    );

    expect(result.current.copyOpen).toBe(false);
    expect(result.current.copyData).toBeNull();

    act(() => {
      result.current.openCopy({ name: "带皮五花肉", l2Code: "MEA-POR" });
    });

    expect(result.current.copyOpen).toBe(true);
    expect(result.current.copyData).toEqual({
      name: "带皮五花肉-副本",
      l2Code: "MEA-POR",
    });
  });

  it("自定义名称后缀", () => {
    const { result } = renderHook(() =>
      useRecordCopy<Record1, FormData>({
        buildInitialData: (row) => ({ l2Code: row.l2Code }),
        nameSuffix: "（新）",
      })
    );

    act(() => {
      result.current.openCopy({ name: "带皮五花肉", l2Code: "MEA-POR" });
    });

    expect(result.current.copyData?.name).toBe("带皮五花肉（新）");
  });

  it("关闭时清空复制数据", () => {
    const { result } = renderHook(() =>
      useRecordCopy<Record1, FormData>({
        buildInitialData: (row) => ({ l2Code: row.l2Code }),
      })
    );

    act(() => {
      result.current.openCopy({ name: "带皮五花肉", l2Code: "MEA-POR" });
    });
    act(() => {
      result.current.closeCopy();
    });

    expect(result.current.copyOpen).toBe(false);
    expect(result.current.copyData).toBeNull();
  });

  it("提交成功后关闭弹窗并触发成功回调", () => {
    const onCopySuccess = jest.fn();
    const { result } = renderHook(() =>
      useRecordCopy<Record1, FormData>({
        buildInitialData: (row) => ({ l2Code: row.l2Code }),
        onCopySuccess,
      })
    );

    act(() => {
      result.current.openCopy({ name: "带皮五花肉", l2Code: "MEA-POR" });
    });

    const props = result.current.copyDialogProps;
    expect(props.open).toBe(true);
    expect(props.initialData).toEqual({
      name: "带皮五花肉-副本",
      l2Code: "MEA-POR",
    });

    act(() => {
      props.onSuccess();
    });

    expect(result.current.copyOpen).toBe(false);
    expect(result.current.copyData).toBeNull();
    expect(onCopySuccess).toHaveBeenCalled();
  });
});
