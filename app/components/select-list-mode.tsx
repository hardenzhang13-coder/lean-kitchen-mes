"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectDialog } from "@/app/components/select-dialog";
import { cn } from "@/lib/utils";

export type SelectListOption = {
  value: string;
  label: string;
};

interface SelectListModeProps {
  options: SelectListOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}

export function SelectListMode({
  options,
  value,
  onChange,
  placeholder = "请选择",
  title = "请选择",
  searchPlaceholder = "搜索...",
  emptyText = "暂无匹配选项",
  disabled = false,
  clearable = true,
  className,
}: SelectListModeProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, search]);

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

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
            selected ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {selected ? selected.label : placeholder}
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
        onOpenChange={setOpen}
        title={title}
        searchPlaceholder={searchPlaceholder}
        searchValue={search}
        onSearchChange={setSearch}
        emptyText={emptyText}
        onCancel={() => setOpen(false)}
      >
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            {emptyText}
          </div>
        ) : (
          <div className="space-y-1 pr-1">
            {filtered.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                    "hover:bg-muted/60 focus:outline-none focus:border-primary",
                    active
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input bg-transparent text-foreground"
                  )}
                >
                  <span className="break-words leading-snug">{option.label}</span>
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </SelectDialog>
    </div>
  );
}
