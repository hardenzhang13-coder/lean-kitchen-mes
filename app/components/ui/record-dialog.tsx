"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AppDialogContent,
  type AppDialogSize,
} from "@/app/components/ui/app-dialog";
import { DiscardChangesDialog } from "@/app/components/ui/discard-changes-dialog";
import { DetailSection, InfoCell } from "@/app/components/ui/detail-section";
import { cn } from "@/lib/shared/utils";

export type RecordDialogMode = "view" | "create" | "edit";

type RecordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: RecordDialogMode;
  /** 查看态用记录名称，新增/编辑态用「新增/编辑 + 实体名」 */
  title: string;
  /** 标题下的辅助信息：编号、角色、状态等 */
  meta?: ReactNode;
  children: ReactNode;
  /** 查看态：进入编辑 */
  onEdit?: () => void;
  /** 查看态：删除入口；不传则不展示删除 */
  onDelete?: () => void;
  /** 编辑/新增态：取消。默认关闭弹窗 */
  onCancel?: () => void;
  /** 编辑/新增态：保存 */
  onSubmit?: () => void;
  /** 是否有未保存改动；关闭或取消时二次确认 */
  dirty?: boolean;
  submitting?: boolean;
  submitLabel?: string;
  deleteDisabled?: boolean;
  deleteTitle?: string;
  /** 放弃改动确认弹窗里的记录名 */
  entityLabel?: string;
  size?: AppDialogSize;
  className?: string;
};

/**
 * 简单记录三态弹窗：查看 / 新增 / 编辑。
 *
 * - 查看态：只读信息 + 底部「删除（左）/ 关闭 / 编辑（右）」，删除只在查看态出现。
 * - 新增与编辑态：只有「取消 / 保存」，危险动作不进入编辑面。
 * - 有未保存改动时，关闭或取消先经 `DiscardChangesDialog` 确认。
 */
export function RecordDialog({
  open,
  onOpenChange,
  mode,
  title,
  meta,
  children,
  onEdit,
  onDelete,
  onCancel,
  onSubmit,
  dirty = false,
  submitting = false,
  submitLabel = "保存",
  deleteDisabled = false,
  deleteTitle,
  entityLabel = "记录",
  size = "form",
  className,
}: RecordDialogProps) {
  const [discardReason, setDiscardReason] = useState<null | "cancel" | "close">(
    null
  );
  const isForm = mode !== "view";

  const closeNow = useCallback(() => onOpenChange(false), [onOpenChange]);

  const requestClose = useCallback(() => {
    if (isForm && dirty) {
      setDiscardReason("close");
      return;
    }
    closeNow();
  }, [closeNow, dirty, isForm]);

  const requestCancel = useCallback(() => {
    if (isForm && dirty) {
      setDiscardReason("cancel");
      return;
    }
    (onCancel ?? closeNow)();
  }, [closeNow, dirty, isForm, onCancel]);

  const discard = useCallback(() => {
    const reason = discardReason;
    setDiscardReason(null);
    if (reason === "cancel") (onCancel ?? closeNow)();
    else closeNow();
  }, [closeNow, discardReason, onCancel]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <AppDialogContent
          size={size}
          className={cn("[&>button]:cursor-pointer", className)}
        >
          <DialogHeader>
            <DialogTitle className="text-lg">{title}</DialogTitle>
            {meta && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
                {meta}
              </div>
            )}
          </DialogHeader>

          {children}

          <DialogFooter>
            {mode === "view" ? (
              <>
                {onDelete && (
                  <Button
                    variant="destructive"
                    className="h-11 px-6 sm:mr-auto"
                    disabled={deleteDisabled}
                    title={deleteTitle}
                    onClick={onDelete}
                  >
                    删除
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="h-11 px-6"
                  onClick={requestClose}
                >
                  关闭
                </Button>
                {onEdit && (
                  <Button className="h-11 px-6" onClick={onEdit}>
                    编辑
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="h-11 px-6"
                  onClick={requestCancel}
                >
                  取消
                </Button>
                <Button
                  className="h-11 px-6"
                  onClick={onSubmit}
                  disabled={submitting}
                >
                  <span aria-live="polite" className="inline-flex items-center">
                    {submitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {submitLabel}
                  </span>
                </Button>
              </>
            )}
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={open && discardReason !== null}
        onOpenChange={(next) => {
          if (!next) setDiscardReason(null);
        }}
        entityLabel={entityLabel}
        onDiscard={discard}
      />
    </>
  );
}

export type RecordViewItem = {
  label: string;
  value: ReactNode;
  /** 价格、数量等核心字段强调显示 */
  emphasis?: boolean;
  /** 地址、备注等长文本跨两列 */
  wide?: boolean;
};

/** 简单记录查看态：一个基础信息分组，双列信息单元。 */
export function RecordView({
  title = "基础信息",
  items,
}: {
  title?: string;
  items: RecordViewItem[];
}) {
  return (
    <DetailSection title={title}>
      {items.map((item) => (
        <div
          key={item.label}
          className={item.wide ? "col-span-2 min-w-0" : "min-w-0"}
        >
          <InfoCell
            label={item.label}
            value={item.value}
            emphasis={item.emphasis}
          />
        </div>
      ))}
    </DetailSection>
  );
}

/** 简单表单：单列、不分组、字段间距 5。 */
export function SimpleForm({ children }: { children: ReactNode }) {
  return <div className="grid gap-5">{children}</div>;
}

/** 简单表单的 dirty 判定：字符串字段对象逐字段比较。 */
export function isRecordDirty(values: object, baseline: object): boolean {
  return JSON.stringify(values) !== JSON.stringify(baseline);
}
