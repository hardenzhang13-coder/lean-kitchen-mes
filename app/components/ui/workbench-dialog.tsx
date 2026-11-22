"use client";

import type { ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { cn } from "@/lib/shared/utils";

interface WorkbenchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * 三级页面默认形态：大弹窗内完成创建 / 编辑 / 查看，不再新开整页。
 * 头部与底部固定，只有中间内容区滚动。
 */
export function WorkbenchDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: WorkbenchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="workbench"
        className={cn(
          "flex max-h-[calc(100dvh-24px)] flex-col gap-0 overflow-hidden p-0",
          className
        )}
      >
        <div className="shrink-0 border-b border-skeu-border skeu-surface px-6 pt-6 pb-4 pr-16">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-1 text-[13px] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-skeu-border bg-white px-6 pt-4 pb-5">
            {footer}
          </div>
        ) : null}
      </AppDialogContent>
    </Dialog>
  );
}
