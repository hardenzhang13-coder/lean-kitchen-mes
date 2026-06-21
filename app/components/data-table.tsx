"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, EmptyStateProps } from "@/app/components/empty-state";
import { LoadingState } from "@/app/components/loading-state";
import { Pagination } from "@/app/components/pagination";
import { cn } from "@/lib/utils";

export type ColumnDef<T> = {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (row: T, rowIndex: number) => React.ReactNode;
  className?: string;
};

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  filters?: React.ReactNode;
  emptyState?: EmptyStateProps;
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T extends object>({
  data,
  columns,
  loading = false,
  pagination,
  filters,
  emptyState,
  rowActions,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const resolvedEmptyState: EmptyStateProps = emptyState || {
    title: "暂无数据",
    description: "当前列表为空",
  };

  const start = pagination
    ? (pagination.currentPage - 1) * pagination.pageSize + 1
    : 1;
  const end = pagination
    ? Math.min(start + pagination.pageSize - 1, pagination.totalItems)
    : data.length;

  const getCellValue = (row: T, col: ColumnDef<T>, rowIndex: number): React.ReactNode => {
    if (col.cell) return col.cell(row, rowIndex);
    if (!col.accessorKey) return null;
    const key = col.accessorKey as string;
    const value = (row as Record<string, unknown>)[key];
    if (value == null) return "—";
    return String(value);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {filters && <div className="flex flex-wrap items-center gap-3">{filters}</div>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, idx) => (
                <TableHead key={idx} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
              {rowActions && <TableHead className="w-[120px]">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (rowActions ? 1 : 0)}>
                  <LoadingState type="inline" />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  className="p-0"
                >
                  <EmptyState {...resolvedEmptyState} />
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIdx) => (
                <TableRow
                  key={rowIdx}
                  onClick={() => onRowClick?.(row)}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((col, colIdx) => (
                    <TableCell key={colIdx} className={col.className}>
                      {getCellValue(row, col, rowIdx)}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
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

      {pagination && pagination.totalItems > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          start={start}
          end={end}
          onPageChange={pagination.onPageChange}
        />
      )}
    </div>
  );
}
