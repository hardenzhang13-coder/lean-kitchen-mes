"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
}

export function SelectDialog({
  open,
  onOpenChange,
  title,
  searchPlaceholder = "搜索...",
  searchValue,
  onSearchChange,
  emptyText = "暂无匹配选项",
  onCancel,
  children,
  footer,
  className,
}: SelectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-[560px] [&>button]:cursor-pointer flex flex-col max-h-[80vh]",
          className
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 pl-9 text-base"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          {footer}
          <Button variant="outline" onClick={onCancel} className="h-11 px-6">
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
