"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";

/** 删除被引用拦截时后端返回的引用明细 */
export interface DeleteErrorInfo {
  message: string;
  references?: Record<string, number>;
}

/**
 * 删除确认弹窗（设置简单表统一规格）：
 * 确认态 = 标题 + 文案 + 描边取消 + danger 删除；
 * 被引用拦截态 = 「无法删除」+ 引用明细 + 引导改停用。
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title = "确认删除",
  message,
  error,
  errorHint = "建议改用「停用」：停用后新单据不再可选，历史数据不受影响。",
  onConfirm,
  confirming = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 确认态标题；出现 error 时固定显示「无法删除」 */
  title?: string;
  /** 确认态正文，如「确定要删除单位「斤」吗？」 */
  message: ReactNode;
  error?: DeleteErrorInfo | null;
  errorHint?: string;
  onConfirm: () => void;
  confirming?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {error ? "无法删除" : title}
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="grid gap-3">
            <p className="text-muted-foreground text-base">{error.message}</p>
            {error.references && Object.keys(error.references).length > 0 && (
              <ul className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground grid gap-1">
                {Object.entries(error.references).map(([entity, count]) => (
                  <li key={entity}>
                    {entity}：{count} 条
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-muted-foreground">{errorHint}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-base">{message}</p>
        )}
        <DialogFooter>
          <SkeuButton variant="outline" onClick={() => onOpenChange(false)}>
            {error ? "知道了" : "取消"}
          </SkeuButton>
          {!error && (
            <SkeuButton
              variant="danger"
              onClick={onConfirm}
              disabled={confirming}
            >
              {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
              删除
            </SkeuButton>
          )}
        </DialogFooter>
      </AppDialogContent>
    </Dialog>
  );
}
