"use client";

import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { CodeText } from "@/app/components/ui/code-text";
import { DishStatusTag } from "@/app/components/ui/dish-status-tag";
import type { DishDetail } from "@/app/components/dish-form/types";
import { DishDetailActions } from "./dish-detail-actions";
import { DishDetailBody, formatDishDateTime } from "./dish-detail-body";

/**
 * 菜品档案正面弹窗（预览）：列表行点击的详情入口（替代原半屏抽屉）。
 * 标题区挂编号 + 创建时间，操作簇完整置于右下页脚；内容体与路由详情页共用。
 */
export function DishDetailDialog({
  dish,
  open,
  onOpenChange,
  onChanged,
  onDeleted,
}: {
  dish: DishDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="workbench"
        className="flex max-h-[90vh] flex-col gap-0 p-0"
      >
        <div className="skeu-surface-muted flex items-start justify-between gap-4 rounded-t-[var(--sk-radius-lg)] border-b border-skeu-border px-6 py-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <DialogTitle className="truncate text-lg">{dish.name}</DialogTitle>
              <DishStatusTag status={dish.status} />
            </div>
            <div className="flex items-center gap-3">
              <CodeText>{dish.code}</CodeText>
              <span className="text-sm text-muted-foreground">
                创建于 {formatDishDateTime(dish.createdAt)}
              </span>
            </div>
            <DialogDescription className="sr-only">
              菜品 {dish.name}（{dish.code}）的完整档案
            </DialogDescription>
          </div>
        </div>

        <div className="skeu-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <DishDetailBody dish={dish} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-skeu-border px-6 py-4">
          <DishDetailActions
            dish={dish}
            onChanged={onChanged}
            onDeleted={() => {
              onOpenChange(false);
              onDeleted();
            }}
          />
        </div>
      </AppDialogContent>
    </Dialog>
  );
}
