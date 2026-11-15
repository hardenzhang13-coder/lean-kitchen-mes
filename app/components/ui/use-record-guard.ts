"use client";

import { useCallback, useState } from "react";

/**
 * 未保存改动守卫：详情抽屉 / 弹窗在有未保存改动时拦截关闭。
 *
 * 用法：
 * - `requestClose` 交给容器的 `onOpenChange`
 * - `discardOpen` 交给 `DiscardChangesDialog`
 * - `onDiscard` 负责「确认放弃」时的清理（重置表单、退出编辑态）
 */

type UseRecordGuardOptions = {
  /** 容器是否打开；关闭时守卫状态自动失效 */
  open: boolean;
  /** 表单是否有未保存改动 */
  isDirty: boolean;
  /** 确认放弃时的清理动作：重置表单、退出编辑态 */
  onDiscard: () => void;
  /** 真正执行关闭 */
  onClose: (nextOpen: boolean) => void;
};

export function useRecordGuard({
  open,
  isDirty,
  onDiscard,
  onClose,
}: UseRecordGuardOptions) {
  const [discardOpen, setDiscardOpen] = useState(false);

  const requestClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isDirty) {
        setDiscardOpen(true);
        return;
      }
      if (!nextOpen) onDiscard();
      onClose(nextOpen);
    },
    [isDirty, onDiscard, onClose]
  );

  const cancelDiscard = useCallback(() => {
    setDiscardOpen(false);
  }, []);

  const discardAndClose = useCallback(() => {
    setDiscardOpen(false);
    onDiscard();
    onClose(false);
  }, [onDiscard, onClose]);

  return {
    /** 是否需要展示丢弃确认弹窗（容器已关闭时不展示） */
    discardOpen: open && discardOpen,
    requestClose,
    cancelDiscard,
    discardAndClose,
  };
}
