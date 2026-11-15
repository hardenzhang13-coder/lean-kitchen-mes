/** @jest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import {
  type RecordFormErrors,
  useRecordForm,
} from "../use-record-form";

type TestForm = {
  name: string;
  price: string;
};

describe("通用记录表单状态", () => {
  it("校验失败时不提交并返回字段错误", async () => {
    const onSubmit = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useRecordForm<TestForm>({
        active: true,
        resetKey: "create",
        initialValues: { name: "", price: "" },
        validate: (values): RecordFormErrors =>
          values.name ? {} : { name: "名称不能为空" },
        onSubmit,
      })
    );

    let success = true;
    await act(async () => {
      success = await result.current.submit();
    });

    expect(success).toBe(false);
    expect(result.current.errors.name).toBe("名称不能为空");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("维护 dirty、提交中和提交成功状态", async () => {
    const onSubmit = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useRecordForm<TestForm>({
        active: true,
        resetKey: "create",
        initialValues: { name: "", price: "" },
        validate: () => ({}),
        onSubmit,
      })
    );

    act(() => {
      result.current.setField("name", "带皮五花肉");
    });
    expect(result.current.form.name).toBe("带皮五花肉");
    expect(result.current.isDirty).toBe(true);

    let success = false;
    await act(async () => {
      success = await result.current.submit();
    });

    expect(success).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith({
      name: "带皮五花肉",
      price: "",
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.submitting).toBe(false);
  });

  it("重置键变化时恢复初始值并触发业务重置", async () => {
    const onReset = jest.fn();
    const { result, rerender } = renderHook(
      ({ resetKey, initialName }) =>
        useRecordForm<TestForm>({
          active: true,
          resetKey,
          initialValues: { name: initialName, price: "" },
          validate: () => ({}),
          onSubmit: async () => true,
          onReset,
        }),
      { initialProps: { resetKey: "create", initialName: "" } }
    );

    act(() => {
      result.current.setField("name", "临时值");
    });
    expect(result.current.form.name).toBe("临时值");

    rerender({ resetKey: "edit-1", initialName: "已有值" });

    await waitFor(() => {
      expect(result.current.form.name).toBe("已有值");
    });
    expect(result.current.isDirty).toBe(false);
    expect(onReset).toHaveBeenCalled();
  });

  it("保存并继续添加时按策略清空字段并保留其余字段", async () => {
    const onSubmit = jest.fn().mockResolvedValue(true);
    const onSaved = jest.fn();
    const { result } = renderHook(() =>
      useRecordForm<TestForm>({
        active: true,
        resetKey: "create",
        initialValues: { name: "", price: "" },
        validate: () => ({}),
        onSubmit,
        onSaved,
        clearOnContinue: ["name"],
      })
    );

    act(() => {
      result.current.setField("name", "带皮五花肉");
      result.current.setField("price", "18.50");
    });

    let success = false;
    await act(async () => {
      success = await result.current.submitContinue();
    });

    expect(success).toBe(true);
    // 名称被清空，价格保留
    expect(result.current.form.name).toBe("");
    expect(result.current.form.price).toBe("18.50");
    expect(onSaved).toHaveBeenCalledWith(
      { name: "带皮五花肉", price: "18.50" },
      true
    );
  });

  it("提供保留白名单时，白名单外字段全部清空", async () => {
    const { result } = renderHook(() =>
      useRecordForm<TestForm>({
        active: true,
        resetKey: "create",
        initialValues: { name: "", price: "" },
        validate: () => ({}),
        onSubmit: async () => true,
        keepOnContinue: ["price"],
      })
    );

    act(() => {
      result.current.setField("name", "带皮五花肉");
      result.current.setField("price", "18.50");
    });

    await act(async () => {
      await result.current.submitContinue();
    });

    expect(result.current.form.name).toBe("");
    expect(result.current.form.price).toBe("18.50");
  });
});
