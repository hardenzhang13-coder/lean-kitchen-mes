"use client";

import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";

export interface IndexCardListRow {
  key: string;
  label: string;
  value: string;
}

interface IndexCardListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  rows: IndexCardListRow[];
  unit?: string;
}

/**
 * 索引卡「查看更多」弹窗：卡面只露前几行，完整清单在弹窗里看。
 * 排菜卡看菜单明细，切配卡看来源门店明细，两卡共用同一形态。
 */
export function IndexCardListDialog({
  open,
  onOpenChange,
  title,
  description,
  rows,
  unit = "份",
}: IndexCardListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="form" className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </DialogHeader>

        <div className="skeu-scroll min-h-0 flex-1 overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid h-[34px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-skeu-border"
            >
              <span className="truncate text-[13px] font-semibold text-foreground">
                {row.label}
              </span>
              <span className="text-[13px] font-bold text-foreground tabular-nums">
                {row.value}
                <small className="ml-0.5 text-xs font-normal text-muted-foreground">
                  {unit}
                </small>
              </span>
            </div>
          ))}
        </div>
      </AppDialogContent>
    </Dialog>
  );
}
