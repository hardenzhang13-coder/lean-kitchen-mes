"use client";

import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { AppDialogContent } from "@/app/components/ui/app-dialog";

interface DiscardChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 记录名称，如「原料」「净料」「菜品」 */
  entityLabel?: string;
  /** 确认放弃并关闭 */
  onDiscard: () => void;
}

/**
 * 放弃未保存改动的确认弹窗：与 `useRecordGuard` 配套。
 */
export function DiscardChangesDialog({
  open,
  onOpenChange,
  entityLabel = "当前记录",
  onDiscard,
}: DiscardChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="text-lg">放弃未保存的修改？</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          当前{entityLabel}有尚未保存的修改，关闭后这些内容将丢失。
        </p>
        <DialogFooter>
          <SkeuButton variant="outline" onClick={() => onOpenChange(false)}>
            继续编辑
          </SkeuButton>
          <SkeuButton variant="danger" onClick={onDiscard}>
            放弃并关闭
          </SkeuButton>
        </DialogFooter>
      </AppDialogContent>
    </Dialog>
  );
}
