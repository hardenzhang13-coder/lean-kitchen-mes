"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  start,
  end,
  onPageChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t">
      <p className="text-sm text-muted-foreground">
        第 <span className="font-medium text-foreground">{start}</span>-
        <span className="font-medium text-foreground">{end}</span> 条，共{" "}
        <span className="font-medium text-foreground">{totalItems}</span> 条
      </p>
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
