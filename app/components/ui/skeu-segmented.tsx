"use client";

import { cn } from "@/lib/shared/utils";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

interface SkeuSegmentedProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  ariaLabel?: string;
}

/**
 * 二级分段控件：放在列表工具条内，用于状态 / 类型 / 范围筛选。
 * 视觉层级低于 PageTabs，不承担页面切换。
 */
export function SkeuSegmented<T extends string = string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: SkeuSegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("skeu-segmented", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "skeu-segmented-btn",
              active && "skeu-segmented-btn-active"
            )}
          >
            <span>{option.label}</span>
            {typeof option.count === "number" ? (
              <span className="skeu-segmented-count">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
