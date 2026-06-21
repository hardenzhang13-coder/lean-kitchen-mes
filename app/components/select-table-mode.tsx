"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SelectDialog } from "@/app/components/select-dialog";
import { Pagination } from "@/app/components/pagination";
import { cn } from "@/lib/utils";

export type SelectTableColumn<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

interface SelectTableModeProps<T extends Record<string, unknown>> {
  data: T[];
  columns: SelectTableColumn<T>[];
  value: string;
  onChange: (value: string, row?: T) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onChange: (page: number) => void;
  };
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  rowKey?: keyof T | string;
  displayValue?: (row: T) => string;
  confirmSelection?: boolean;
  className?: string;
}

export function SelectTableMode<T extends Record<string, unknown>>({
  data,
  columns,
  value,
  onChange,
  pagination,
  placeholder = "请选择",
  title = "请选择",
  searchPlaceholder = "搜索...",
  emptyText = "暂无匹配选项",
  disabled = false,
  clearable = true,
  rowKey = "id",
  displayValue,
  confirmSelection = false,
  className,
}: SelectTableModeProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  const selectedRow = useMemo(() => {
    const key = rowKey as string;
    return data.find((row) => String(row[key]) === value);
  }, [data, value, rowKey]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter((row) =>
      columns.some((col) => {
        if (col.render) {
          const rendered = col.render(row);
          if (rendered == null) return false;
          return String(rendered).toLowerCase().includes(s);
        }
        const key = col.key as string;
        const v = row[key];
        if (v == null) return false;
        return String(v).toLowerCase().includes(s);
      })
    );
  }, [data, search, columns]);

  const getRowValue = (row: T): string => {
    const key = rowKey as string;
    return String(row[key]);
  };

  const handleRowClick = (row: T) => {
    const v = getRowValue(row);
    if (confirmSelection) {
      setPendingValue(v);
      return;
    }
    onChange(v, row);
    setOpen(false);
    setSearch("");
  };

  const handleConfirm = () => {
    if (pendingValue == null) return;
    const row = data.find((r) => getRowValue(r) === pendingValue);
    onChange(pendingValue, row);
    setOpen(false);
    setPendingValue(null);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const displayLabel = selectedRow
    ? displayValue?.(selectedRow) || getRowValue(selectedRow)
    : placeholder;

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="h-11 w-full justify-between px-4 text-base font-normal"
      >
        <span
          className={cn(
            "truncate",
            selectedRow ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {displayLabel}
        </span>
        <span className="flex items-center gap-1 ml-2 shrink-0">
          {value && clearable && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="rounded-sm hover:bg-muted p-0.5"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </span>
      </Button>

      <SelectDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setPendingValue(null);
        }}
        title={title}
        searchPlaceholder={searchPlaceholder}
        searchValue={search}
        onSearchChange={setSearch}
        emptyText={emptyText}
        onCancel={() => {
          setOpen(false);
          setPendingValue(null);
        }}
        className="sm:max-w-[900px] max-w-[calc(100%-4rem)]"
        footer={
          confirmSelection ? (
            <Button
              onClick={handleConfirm}
              disabled={pendingValue == null}
              className="h-11 px-6"
            >
              确认选择
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-auto rounded-md border">
            {filtered.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                {emptyText}
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {confirmSelection && <TableHead className="w-10"></TableHead>}
                    {columns.map((col) => (
                      <TableHead key={col.key} className={col.className}>
                        {col.header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row, idx) => {
                    const rowValue = getRowValue(row);
                    const active = confirmSelection
                      ? pendingValue === rowValue
                      : value === rowValue;
                    return (
                      <TableRow
                        key={idx}
                        onClick={() => handleRowClick(row)}
                        className={cn(
                          "cursor-pointer",
                          active && "bg-primary/15 border-l-4 border-primary font-semibold"
                        )}
                      >
                        {confirmSelection && (
                          <TableCell>
                            {active && <Check className="h-4 w-4 text-primary" />}
                          </TableCell>
                        )}
                        {columns.map((col) => (
                          <TableCell key={col.key} className={col.className}>
                            {col.render
                              ? col.render(row)
                              : String(row[col.key as string] ?? "—")}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="pt-3">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={filtered.length}
                start={1}
                end={filtered.length}
                onPageChange={pagination.onChange}
              />
            </div>
          )}
        </div>
      </SelectDialog>
    </div>
  );
}
