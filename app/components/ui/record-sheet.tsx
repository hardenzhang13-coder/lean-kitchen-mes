"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/shared/utils";

export type RecordSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function RecordSheet({
  open,
  onOpenChange,
  title,
  meta,
  children,
  footer,
  className,
  bodyClassName,
}: RecordSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      disablePointerDismissal={false}
    >
      <SheetContent
        onBackdropClick={() => onOpenChange(false)}
        className={cn(
          "flex w-full flex-col p-0 sm:w-1/2 sm:max-w-none",
          className
        )}
      >
        <SheetHeader className="border-b px-6 py-5">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="min-w-0 space-y-1">
              <SheetTitle className="break-words text-lg">{title}</SheetTitle>
              {meta && (
                <SheetDescription className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  {meta}
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        <div
          className={cn(
            "flex-1 space-y-5 overflow-y-auto px-6 py-5",
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer && (
          <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

export type RecordActionsProps = {
  destructive?: ReactNode;
  secondary?: ReactNode;
  primary?: ReactNode;
  className?: string;
};

/**
 * 详情页操作槽位：危险操作在左、次级操作居中、核心操作在右。
 */
export function RecordActions({
  destructive,
  secondary,
  primary,
  className,
}: RecordActionsProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-end gap-2",
        className
      )}
    >
      {destructive}
      {secondary}
      {primary}
    </div>
  );
}
