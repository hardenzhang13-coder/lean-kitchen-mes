"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/shared/utils";

export type SkeuDotTone = "all" | "success" | "warning";

export interface SkeuDotOption {
  value: string;
  label: string;
  /** 圆点语义色：全部灰 / 启用中绿 / 已停用琥珀 */
  tone?: SkeuDotTone;
}

export interface SkeuDotSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SkeuDotOption[];
  className?: string;
  "aria-label"?: string;
}

const TONE_CLASS: Record<SkeuDotTone, string> = {
  all: "skeu-dot-all",
  success: "skeu-dot-success",
  warning: "skeu-dot-warning",
};

/**
 * 轻拟物状态筛选：圆点 + 文字的下拉。
 * 触发器与选项共用圆点语义色；选中项浅橙底 + 加粗 + 右侧勾。
 */
export function SkeuDotSelect({
  value,
  onChange,
  options,
  className,
  ...rest
}: SkeuDotSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={rest["aria-label"] ?? "状态筛选"}
        className={cn(
          "flex h-11 min-w-[160px] items-center gap-2.5 rounded-[var(--sk-radius-sm)] border border-skeu-border-strong skeu-surface px-3.5 text-sm font-medium shadow-sk-raised transition-transform duration-150 active:translate-y-px focus-visible:bg-[var(--sk-control-bg)] focus-visible:border-[var(--sk-focus)] focus-visible:outline-none",
          className
        )}
      >
        <span
          className={cn(
            "skeu-dot",
            TONE_CLASS[selected?.tone ?? "all"]
          )}
        />
        <span className="flex-1 text-left">{selected?.label ?? "全部"}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[220px] gap-0 rounded-[var(--sk-radius-md)] border-skeu-border skeu-surface p-2 shadow-sk-2 ring-0"
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex h-10 w-full items-center gap-2.5 rounded-[var(--sk-radius-xs)] px-3 text-left text-sm transition-colors focus-visible:bg-[var(--sk-primary-soft-solid)] focus-visible:outline-none",
                isSelected && "bg-[var(--sk-primary-soft-solid)] font-semibold"
              )}
            >
              <span className={cn("skeu-dot", TONE_CLASS[option.tone ?? "all"])} />
              <span>{option.label}</span>
              <Check
                className={cn(
                  "ml-auto h-4 w-4 text-primary opacity-0",
                  isSelected && "opacity-100"
                )}
              />
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}