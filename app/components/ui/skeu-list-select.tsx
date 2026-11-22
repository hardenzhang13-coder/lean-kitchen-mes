"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/shared/utils";

/** 选项前缀圆点 tone，与 globals.css 的 .skeu-dot-* 一一对应 */
export type SkeuListDotTone =
  | "all"
  | "danger"
  | "rose"
  | "green"
  | "success"
  | "warning";

export interface SkeuListSelectOption {
  value: string;
  label: string;
  /** 选项前缀圆点；不填则无圆点 */
  dot?: SkeuListDotTone;
}

interface SkeuListSelectProps {
  /** 当前选中值，空串 = 全部 */
  value: string;
  onChange: (value: string) => void;
  options: SkeuListSelectOption[];
  /** 触发器 aria 标签 */
  ariaLabel: string;
  /** 首项「全部」文案；缺省不显示全部项 */
  allLabel?: string;
  /** 选项多（>10）时开启浮层内搜索 */
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

/**
 * 拟物平铺列表选择：**仅用于选项 >10 个的枚举筛选**（如菜品类别）。
 * 无遮罩浮层（Popover）而非弹窗：选项全量平铺，一行最多 3 列，不出现滚动条；
 * 触发器与 SkeuComboboxTrigger 同款的 skeu-trigger 标准件，点击即生效。
 * 选项 ≤10 个的枚举筛选用 SkeuDotSelect / SkeuSegmented，不用本组件。
 */
export function SkeuListSelect({
  value,
  onChange,
  options,
  ariaLabel,
  allLabel,
  searchable = false,
  searchPlaceholder = "搜索...",
  className,
}: SkeuListSelectProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  const selected = options.find((option) => option.value === value);
  const triggerLabel = value
    ? (selected?.label ?? value)
    : (allLabel ?? selected?.label ?? "");

  const filtered = useMemo(() => {
    const kw = keyword.trim();
    if (!kw) return options;
    return options.filter((option) => option.label.includes(kw));
  }, [options, keyword]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setKeyword("");
  };

  const renderTile = (
    optionValue: string,
    label: string,
    dot?: SkeuListDotTone
  ) => {
    const active = optionValue === value;
    return (
      <button
        key={optionValue || "__all__"}
        type="button"
        onClick={() => pick(optionValue)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-[var(--sk-radius-sm)] border px-3 text-left text-sm transition-colors",
          active
            ? "border-[var(--sk-primary-to)] bg-[var(--sk-primary-soft)] font-semibold text-[var(--sk-primary-ink)] shadow-[var(--sk-primary-shadow)]"
            : "border-skeu-border-strong skeu-surface hover:border-[#f97316aa]"
        )}
      >
        {dot && <span className={cn("skeu-dot", `skeu-dot-${dot}`)} />}
        <span className="truncate">{label}</span>
        {active && <Check className="ml-auto h-4 w-4 shrink-0" />}
      </button>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setKeyword("");
      }}
    >
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn(
          "skeu-trigger flex w-full items-center justify-between gap-2 text-left font-normal",
          className
        )}
      >
        <span
          className={cn(
            "truncate",
            triggerLabel ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {triggerLabel || "请选择"}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[420px] gap-2 rounded-[var(--sk-radius-md)] border-skeu-border skeu-surface p-3 shadow-sk-2 ring-0"
      >
        {searchable && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="skeu-input h-10 w-full pl-9 pr-3 text-sm"
            />
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {allLabel !== undefined && renderTile("", allLabel, "all")}
          {filtered.map((option) => renderTile(option.value, option.label, option.dot))}
        </div>
        {filtered.length === 0 && (
          <div className="py-3 text-center text-sm text-muted-foreground">
            未找到匹配的选项
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
