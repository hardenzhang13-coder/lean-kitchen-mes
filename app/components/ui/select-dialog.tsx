"use client";

import { Search } from "lucide-react";


import { Input } from "@/app/components/ui/form-controls";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AppDialogContent,
  type AppDialogSize,
} from "@/app/components/ui/app-dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { cn } from "@/lib/shared/utils";

interface SelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  emptyText?: string;
  onCancel: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  hideSearch?: boolean;
  /** 语义尺寸，默认 form；调用方不得自行声明像素宽度 */
  size?: AppDialogSize;
}

export function SelectDialog({
  open,
  onOpenChange,
  title,
  searchPlaceholder = "搜索...",
  searchValue,
  onSearchChange,
  onCancel,
  children,
  footer,
  className,
  hideSearch = false,
  size = "form",
}: SelectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size={size}
        className={cn(
          "[&>button]:cursor-pointer flex flex-col max-h-[80vh]",
          className
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 flex-1 min-h-0 overflow-hidden flex flex-col">
          {!hideSearch && (
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-11 pl-9 text-base"
              />
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          {footer}
          <SkeuButton variant="outline" onClick={onCancel}>
            取消
          </SkeuButton>
        </div>
      </AppDialogContent>
    </Dialog>
  );
}
