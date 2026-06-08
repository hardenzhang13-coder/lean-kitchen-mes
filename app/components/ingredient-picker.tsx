"use client";

import { useState, useMemo } from "react";
import { Search, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type IngredientOption = {
  value: string;
  label: string;
  subLabel?: string;
};

interface IngredientPickerProps {
  options: IngredientOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
}

export function IngredientPicker({
  options,
  value,
  onChange,
  placeholder = "请选择食材",
  title = "选择食材",
  disabled = false,
  className = "",
}: IngredientPickerProps) {
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
        o.subLabel?.toLowerCase().includes(s) ||
        o.value.toLowerCase().includes(s)
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
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`h-11 w-full justify-between px-4 text-base font-normal ${className}`}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? `${selected.label} (${selected.subLabel || selected.value})` : placeholder}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={-1}
            onClick={handleClear}
            className="rounded-sm hover:bg-muted p-0.5 ml-2"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索食材名称或编号..."
                className="h-11 pl-9 text-base"
              />
            </div>
            {filtered.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                暂无匹配食材
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1 max-h-[360px] overflow-y-auto">
                {filtered.map((option) => {
                  const active = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`
                        flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm
                        transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring
                        ${active ? "bg-primary/5 text-primary border border-primary/20" : "border border-transparent text-foreground"}
                      `}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        {option.subLabel && (
                          <span className="text-xs text-muted-foreground">{option.subLabel}</span>
                        )}
                      </div>
                      {active && <Check className="h-4 w-4 text-primary shrink-0" />}
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
