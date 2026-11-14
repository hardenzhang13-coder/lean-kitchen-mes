"use client";

import type { ComponentProps } from "react";
import { Dialog } from "@/components/ui/dialog";

/**
 * 录入型弹窗统一入口。
 *
 * Base UI 的 disablePointerDismissal 会阻止点击遮罩和焦点移出导致的关闭，
 * Esc、右上角关闭和取消按钮仍按原有逻辑工作。
 */
export function FormDialog(props: ComponentProps<typeof Dialog>) {
  return <Dialog disablePointerDismissal {...props} />;
}
