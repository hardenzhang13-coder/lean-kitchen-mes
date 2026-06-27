"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectDialog } from "@/app/components/select-dialog";
import { cn } from "@/lib/utils";

export type SelectTileOption = {
  value: string;
  label: string;
  description?: string;
};

interface SelectTileModeProps {
  options: SelectTileOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  cols?: 2 | 3;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  cascade?: {
    enabled: boolean;
    onLevelSelected?: (value: string) => void;
  };
}

export function SelectTileMode({
  options,
  value,
  onChange,
  placeholder = "请选择",
  title = "请选择",
  searchPlaceholder = "搜索选项...",
  emptyText = "暂无匹配选项",
  disabled = false,
  searchable = true,
  cols = 3,
  className,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  cascade,
}: SelectTileModeProps) {
  const [openInternal, setOpenInternal] = useState(false);
  const [search, setSearch] = useState("");

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenInternal(v);
    onOpenChangeProp?.(v);
  };

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(s) ||
        o.value.toLowerCase().includes(s) ||
        (o.description && o.description.toLowerCase().includes(s))
    );
  }, [options, search]);

  const handleSelect = (v: string) => {
    onChange(v);
    if (cascade?.enabled) {
      cascade.onLevelSelected?.(v);
    } else {
      setOpen(false);
    }
    setSearch("");
  };

  const hideSearch = !searchable || options.length < 5;

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="h-11 w-full justify-between px-4 text-base font-normal"
      >
        <span
          className={cn(
            "truncate",
            selected ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 ml-2 shrink-0">
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </span>
      </Button>

      <SelectDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        searchPlaceholder={searchPlaceholder}
        searchValue={search}
        onSearchChange={setSearch}
        emptyText={emptyText}
        onCancel={() => setOpen(false)}
        hideSearch={hideSearch}
      >
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            {emptyText}
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-2",
              cols === 2
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3"
            )}
          >
            {filtered.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "relative flex flex-col items-start gap-0.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                    "hover:bg-muted/60 focus:outline-none focus:border-primary",
                    active
                      ? "border-primary bg-primary/5 text-primary hover:bg-primary/10"
                      : "border-input bg-transparent text-foreground"
                  )}
                >
                  <span className="font-medium w-full pr-5">{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                  {active && (
                    <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </SelectDialog>
    </div>
  );
}
