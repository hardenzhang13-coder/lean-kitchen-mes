/** @jest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { useRecordGuard } from "../use-record-guard";

describe("未保存改动守卫", () => {
  it("无改动时直接关闭", () => {
    const onDiscard = jest.fn();
    const onClose = jest.fn();
    const { result } = renderHook(() =>
      useRecordGuard({
        open: true,
        isDirty: false,
        onDiscard,
        onClose,
      })
    );

    act(() => {
      result.current.requestClose(false);
    });

    expect(result.current.discardOpen).toBe(false);
    expect(onDiscard).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("有改动时拦截关闭并弹出确认", () => {
    const onDiscard = jest.fn();
    const onClose = jest.fn();
    const { result } = renderHook(() =>
      useRecordGuard({
        open: true,
        isDirty: true,
        onDiscard,
        onClose,
      })
    );

    act(() => {
      result.current.requestClose(false);
    });

    expect(result.current.discardOpen).toBe(true);
    expect(onDiscard).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("确认放弃后清理并关闭", () => {
    const onDiscard = jest.fn();
    const onClose = jest.fn();
    const { result } = renderHook(() =>
      useRecordGuard({
        open: true,
        isDirty: true,
        onDiscard,
        onClose,
      })
    );

    act(() => {
      result.current.requestClose(false);
    });
    act(() => {
      result.current.discardAndClose();
    });

    expect(result.current.discardOpen).toBe(false);
    expect(onDiscard).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("继续编辑只关闭确认弹窗", () => {
    const onDiscard = jest.fn();
    const onClose = jest.fn();
    const { result } = renderHook(() =>
      useRecordGuard({
        open: true,
        isDirty: true,
        onDiscard,
        onClose,
      })
    );

    act(() => {
      result.current.requestClose(false);
    });
    act(() => {
      result.current.cancelDiscard();
    });

    expect(result.current.discardOpen).toBe(false);
    expect(onDiscard).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("容器已关闭时不展示确认弹窗", () => {
    const { result } = renderHook(() =>
      useRecordGuard({
        open: false,
        isDirty: true,
        onDiscard: jest.fn(),
        onClose: jest.fn(),
      })
    );

    act(() => {
      result.current.requestClose(false);
    });

    expect(result.current.discardOpen).toBe(false);
  });
});
