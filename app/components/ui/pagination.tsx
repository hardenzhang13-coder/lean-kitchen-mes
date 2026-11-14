"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div className="flex h-12 items-center justify-end gap-2 border-t pt-4">
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
  );
}
