"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, EmptyStateProps } from "@/app/components/ui/empty-state";
import { LoadingState } from "@/app/components/ui/loading-state";
import { Pagination } from "@/app/components/ui/pagination";
import { cn } from "@/lib/shared/utils";

export type ColumnDef<T> = {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (row: T, rowIndex: number) => React.ReactNode;
  className?: string;
  /** 横向滚动时固定该列，列表主字段用 left，操作列由 stickyActions 控制 */
  sticky?: "left" | "right";
};

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  /** 视觉形态：default 保持扁平列表；skeu 启用轻拟物表体 */
  variant?: "default" | "skeu";
  /** skeu 行高：default 52px；tall 60px，用于菜品库等需要展示更多信息的列表 */
  rowSize?: "default" | "tall";
  /** 行层级标记，树形列表用它区分一级行与二级行底色 */
  getRowLevel?: (row: T) => string | undefined;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    /** 兼容现有调用方；列表底部统一不显示每页条数选择器 */
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: readonly number[];
    /** 底部左侧汇总文案，如「共 48 条原料」 */
    totalLabel?: string;
    /** 是否展示每页条数选择器（默认不展示） */
    showPageSize?: boolean;
    /** 是否展示完整翻页控件（首页/尾页 + 全部页码）；抽屉内参照列表传 false */
    fullControls?: boolean;
  };
  filters?: React.ReactNode;
  emptyState?: EmptyStateProps;
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  className?: string;
  /** 数据密集列表使用 compact；食材清单等高频扫读列表可用 dense */
  density?: "dense" | "compact" | "default";
  /** 有操作列时默认固定在右侧 */
  stickyActions?: boolean;
  /** 需要表头固定/表体内部滚动时传入，如 calc(100dvh-390px) */
  tableMaxHeight?: string;
  /** 列表页填满父容器，表体在可用空间内滚动 */
  fillHeight?: boolean;
  /** 透传给 table，例如 table-fixed */
  tableClassName?: string;
  /** 操作列宽度，默认 132px；含行内主操作按钮时放宽 */
  actionsWidth?: string;
}

export function DataTable<T extends object>({
  data,
  columns,
  loading = false,
  variant = "default",
  rowSize = "default",
  getRowLevel,
  pagination,
  filters,
  emptyState,
  rowActions,
  onRowClick,
  isRowSelected,
  className,
  density = "compact",
  stickyActions = true,
  tableMaxHeight,
  fillHeight = false,
  tableClassName,
  actionsWidth = "w-[132px]",
}: DataTableProps<T>) {
  const resolvedEmptyState: EmptyStateProps = emptyState || {
    title: "暂无数据",
    description: "当前列表为空",
  };

  const getCellValue = (row: T, col: ColumnDef<T>, rowIndex: number): React.ReactNode => {
    if (col.cell) return col.cell(row, rowIndex);
    if (!col.accessorKey) return null;
    const key = col.accessorKey as string;
    const value = (row as Record<string, unknown>)[key];
    if (value == null) return "—";
    return String(value);
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-4",
        // 拟物形态：面板撑满可用高度，表格区填满剩余空间，分页吸底（参照 demo 表格高度）
        variant === "skeu" && "gap-0",
        fillHeight && "h-full",
        className
      )}
    >
      {filters && <div className="flex flex-wrap items-center gap-3">{filters}</div>}

      {!loading && data.length === 0 ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 items-center justify-center",
            variant === "skeu"
              ? "skeu-table-scroll skeu-scroll overflow-auto"
              : "rounded-md border"
          )}
        >
          <EmptyState {...resolvedEmptyState} className="w-full" />
        </div>
      ) : (
      <div
        data-density={
          variant === "skeu" && density === "dense" ? "dense" : undefined
        }
        data-row-size={
          variant === "skeu" && rowSize === "tall" ? "tall" : undefined
        }
        className={cn(
          variant === "skeu"
            ? "skeu-table-scroll skeu-scroll overflow-auto"
            : "rounded-md border",
          (tableMaxHeight || fillHeight) &&
            "overflow-auto [&_[data-slot=table-container]]:overflow-visible",
          fillHeight && "min-h-0 flex-1"
        )}
        style={tableMaxHeight ? { maxHeight: tableMaxHeight } : undefined}
      >
        <Table className={tableClassName}>
          <TableHeader className="sticky top-0 z-20 bg-background">
            <TableRow>
              {columns.map((col, idx) => (
                <TableHead
                  key={idx}
                  className={cn(
                    "font-semibold",
                    col.className,
                    col.sticky === "left" &&
                      "sticky left-0 z-20 bg-background shadow-[var(--sk-sticky-shadow-left)]",
                    col.sticky === "right" &&
                      "sticky right-0 z-20 bg-background shadow-[var(--sk-sticky-shadow-right)]"
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
              {rowActions && (
                <TableHead
                  className={cn(
                    "text-right font-semibold",
                    actionsWidth,
                    stickyActions &&
                      "sticky right-0 z-20 bg-background shadow-[var(--sk-sticky-shadow-right)]"
                  )}
                >
                  操作
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  data-skeu-cell="plain"
                >
                  <LoadingState type="inline" />
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIdx) => (
                <TableRow
                  key={rowIdx}
                  data-row-level={getRowLevel?.(row)}
                  onClick={() => onRowClick?.(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(event) => {
                    if (!onRowClick || event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  className={cn(
                    "group",
                    density === "dense" && "[&>td]:py-1",
                    density === "compact" && "[&>td]:py-2",
                    onRowClick && "cursor-pointer",
                    isRowSelected?.(row) && "bg-primary/5"
                  )}
                >
                  {columns.map((col, colIdx) => (
                    <TableCell
                      key={colIdx}
                      data-sticky={col.sticky ? true : undefined}
                      className={cn(
                        col.className,
                        col.sticky === "left" &&
                          "sticky left-0 z-10 bg-card group-hover:bg-muted shadow-[var(--sk-sticky-shadow-left)]",
                        col.sticky === "right" &&
                          "sticky right-0 z-10 bg-card group-hover:bg-muted shadow-[var(--sk-sticky-shadow-right)]"
                      )}
                    >
                      {getCellValue(row, col, rowIdx)}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell
                      data-sticky={stickyActions ? true : undefined}
                      className={cn(
                        stickyActions &&
                          "sticky right-0 z-10 bg-card group-hover:bg-muted shadow-[var(--sk-sticky-shadow-right)]"
                      )}
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        {rowActions(row)}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {pagination && pagination.totalItems > 0 && (
        <div className={cn("shrink-0", variant === "skeu" && "skeu-panel-foot")}>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageSizeChange={pagination.onPageSizeChange}
            pageSizeOptions={pagination.pageSizeOptions}
            totalLabel={pagination.totalLabel}
            showPageSize={pagination.showPageSize}
            fullControls={pagination.fullControls}
          />
        </div>
      )}
    </div>
  );
}
