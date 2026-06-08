"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type TileOption = {
  value: string;
  label: string;
  description?: string;
};

interface TileSelectProps {
  options: TileOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  emptyText?: string;
}

export function TileSelect({
  options,
  value,
  onChange,
  placeholder = "请选择",
  title = "请选择",
  searchPlaceholder = "搜索选项...",
  disabled = false,
  required = false,
  emptyText = "暂无匹配选项",
}: TileSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

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
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="h-11 w-full justify-between px-4 text-base font-normal"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 ml-2">
          {value && !required && (
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] [&>button]:cursor-pointer">
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
            {filtered.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                {emptyText}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto p-0.5">
                {filtered.map((option) => {
                  const active = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`
                        relative flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm
                        transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring
                        ${
                          active
                            ? "border-primary bg-primary/5 text-primary hover:bg-primary/10"
                            : "border-input bg-transparent text-foreground"
                        }
                      `}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="h-11 px-6">
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
