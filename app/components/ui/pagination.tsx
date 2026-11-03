"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE_OPTIONS } from "@/lib/client/use-pagination";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
  /** 传入后显示「每页显示数」选择器 */
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  start,
  end,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          第 <span className="font-medium text-foreground">{start}</span>-
          <span className="font-medium text-foreground">{end}</span> 条，共{" "}
          <span className="font-medium text-foreground">{totalItems}</span> 条
        </p>
        {onPageSizeChange && pageSize != null && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            title="每页显示条数"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} 条/页
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="首页"
        >
          <ChevronsLeft className="h-4 w-4 mr-1" />
          首页
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="上一页"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          上一页
        </Button>
        <span className="text-sm text-muted-foreground px-2">
          <span className="font-medium text-foreground">{currentPage}</span> /{" "}
          {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="下一页"
        >
          下一页
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="尾页"
        >
          尾页
          <ChevronsRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
