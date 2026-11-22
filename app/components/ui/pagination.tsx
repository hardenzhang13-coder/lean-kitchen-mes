"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeuButton } from "@/app/components/ui/skeu-button";
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
  /**
   * 是否展示完整翻页控件（首页/尾页 + 全部页码）。
   * 抽屉/弹窗内的参照列表用 false 走精简翻页（上一页 + 当前页 + 下一页）。
   */
  fullControls?: boolean;
}

/**
 * 页码序列：首页与尾页始终可见，页数过多时中间折叠为省略号。
 * 总页数 ≤ 7 时展示全部页码。
 */
function buildPageList(currentPage: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage - 1 > 1) pages.add(currentPage - 1);
  if (currentPage + 1 < totalPages) pages.add(currentPage + 1);
  const sorted = [...pages].sort((a, b) => a - b);
  const list: (number | "gap")[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) list.push("gap");
    list.push(page);
  });
  return list;
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
  fullControls = true,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const sizeOptions = pageSizeOptions.filter((size) => size > 0);
  const pageList = fullControls
    ? buildPageList(currentPage, totalPages)
    : ([currentPage] as (number | "gap")[]);

  return (
    <div
      data-slot="pagination"
      className={cn(
        "flex h-12 items-center gap-2 border-t border-skeu-border pt-4",
        totalLabel ? "justify-between" : "justify-end"
      )}
    >
      {totalLabel ? (
        <span className="text-[13px] font-semibold text-primary">{totalLabel}</span>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-2">
        {showPageSize && onPageSizeChange && sizeOptions.length > 0 && (
          <Select
            value={String(pageSize ?? sizeOptions[0])}
            onValueChange={(value) => {
              const next = Number(value);
              if (Number.isFinite(next)) onPageSizeChange(next);
            }}
          >
            <SelectTrigger className="skeu-btn h-9 rounded-[9px] border-skeu-border-strong skeu-surface px-3 text-[13px] font-medium shadow-sk-raised">
              <SelectValue>{`${pageSize ?? sizeOptions[0]} 条/页`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {`${size} 条/页`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <SkeuButton
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          上一页
        </SkeuButton>

        <div className="flex items-center gap-1.5">
          {pageList.map((page, index) =>
            page === "gap" ? (
              <span
                key={`gap-${index}`}
                className="px-1 text-sm leading-none text-muted-foreground"
              >
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                aria-current={page === currentPage ? "page" : undefined}
                aria-label={`第 ${page} 页`}
                onClick={() => onPageChange(page)}
                className={cn(
                  "skeu-btn grid h-9 min-w-9 place-items-center rounded-[var(--sk-radius-xs)] px-2 text-sm",
                  page === currentPage
                    ? "bg-[image:var(--sk-primary-surface)] font-semibold text-white shadow-[var(--sk-primary-page-shadow)]"
                    : "skeu-btn-outline font-medium"
                )}
              >
                {page}
              </button>
            )
          )}
        </div>

        <SkeuButton
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          下一页
          <ChevronRight className="h-4 w-4" />
        </SkeuButton>
      </div>
    </div>
  );
}