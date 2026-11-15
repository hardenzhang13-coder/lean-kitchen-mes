"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/shared/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** 以下字段保留用于兼容既有列表调用，不再在底部分页栏展示。 */
  totalItems?: number;
  start?: number;
  end?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  /** 底部左侧汇总文案，如「共 48 条原料」；不传则只显示翻页 */
  totalLabel?: string;
  /** 是否展示每页条数选择器（默认不展示，保持交互基线的统一底部） */
  showPageSize?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  totalLabel,
  showPageSize = false,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  if (totalItems === 0) return null;

  const sizeOptions = pageSizeOptions.filter((size) => size > 0);

  return (
    <div
      className={cn(
        "flex h-12 items-center gap-2 border-t pt-4",
        totalLabel ? "justify-between" : "justify-end"
      )}
    >
      {totalLabel ? (
        <span className="text-sm text-muted-foreground">{totalLabel}</span>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-2">
        {showPageSize && onPageSizeChange && sizeOptions.length > 0 && (
          <label className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>每页显示</span>
            <Select
              value={String(pageSize ?? sizeOptions[0])}
              onValueChange={(value) => {
                const next = Number(value);
                if (Number.isFinite(next)) onPageSizeChange(next);
              }}
            >
              <SelectTrigger className="h-8 w-[68px] px-2 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>条</span>
          </label>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          上一页
        </Button>
        <span className="min-w-12 text-center text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{currentPage}</span> /{" "}
          {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          下一页
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}