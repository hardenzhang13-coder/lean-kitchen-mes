"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, Search, X, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SearchableTableColumn<T = unknown> = {
  key: keyof T | string;
  title: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
};

interface SearchableTableSelectProps<T = unknown> {
  fetchUrl: string;
  value: string;
  onChange: (value: string, row?: T) => void;
  columns: SearchableTableColumn<T>[];
  searchFields?: (keyof T | string)[];
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  rowKey?: keyof T | string;
  displayValue?: (row: T) => string;
  confirmSelection?: boolean;
}

export function SearchableTableSelect<
  T extends Record<string, unknown> = Record<string, unknown>
>({
  fetchUrl,
  value,
  onChange,
  columns,
  searchFields,
  placeholder = "请选择",
  title = "请选择",
  searchPlaceholder = "搜索...",
  emptyText = "暂无匹配数据",
  disabled = false,
  clearable = true,
  rowKey = "id",
  displayValue,
  confirmSelection = false,
}: SearchableTableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  const keyOf = useCallback(
    (row: T): string => {
      const v = row[rowKey as string];
      return v != null ? String(v) : "";
    },
    [rowKey]
  );

  const selectedRow = useMemo(
    () => items.find((r) => keyOf(r) === value),
    [items, value, keyOf]
  );

  const selectedLabel = useMemo(() => {
    if (!selectedRow) return "";
    return displayValue ? displayValue(selectedRow) : keyOf(selectedRow);
  }, [selectedRow, displayValue, keyOf]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPendingValue(value || null);
    fetch(fetchUrl)
      .then((r) => r.json() as Promise<unknown>)
      .then((data) => {
        const list = Array.isArray(data) ? (data as T[]) : [];
        setItems(list);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, fetchUrl, value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    const fields =
      searchFields && searchFields.length > 0
        ? searchFields
        : columns.map((c) => c.key);
    return items.filter((row) =>
      fields.some((field) => {
        const v = row[field as string];
        if (v == null) return false;
        return String(v).toLowerCase().includes(s);
      })
    );
  }, [items, search, searchFields, columns]);

  const handleSelect = (row: T) => {
    onChange(keyOf(row), row);
    setOpen(false);
    setSearch("");
    setPendingValue(null);
  };

  const handleConfirm = () => {
    if (!pendingValue) return;
    const row = items.find((r) => keyOf(r) === pendingValue);
    handleSelect(row || ({} as T));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("", undefined);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
      setPendingValue(null);
    }
  };

  return (
    <>
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
          {selectedRow ? selectedLabel : placeholder}
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
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-w-[calc(100%-4rem)] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-11 pl-9 text-base"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                {emptyText}
              </div>
            ) : (
              <div className="rounded-md border overflow-auto max-h-[360px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead
                          key={String(col.key)}
                          className={cn("whitespace-nowrap", col.className)}
                        >
                          {col.title}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const rowKeyValue = keyOf(row);
                      const active = confirmSelection
                        ? pendingValue === rowKeyValue
                        : value === rowKeyValue;
                      return (
                        <TableRow
                          key={rowKeyValue}
                          onClick={() =>
                            confirmSelection
                              ? setPendingValue(rowKeyValue)
                              : handleSelect(row)
                          }
                          className={cn(
                            "cursor-pointer hover:bg-muted/60",
                            active &&
                              "bg-primary/15 border-l-4 border-primary font-semibold"
                          )}
                        >
                          {columns.map((col) => (
                            <TableCell
                              key={String(col.key)}
                              className={cn(
                                "whitespace-nowrap",
                                col.className
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {active && col.key === columns[0].key && (
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                )}
                                <span>
                                  {col.render
                                    ? col.render(row)
                                    : String(row[col.key as string] ?? "—")}
                                </span>
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="h-11 px-6"
            >
              取消
            </Button>
            {confirmSelection && (
              <Button
                onClick={handleConfirm}
                disabled={!pendingValue}
                className="h-11 px-6"
              >
                确认选择
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
