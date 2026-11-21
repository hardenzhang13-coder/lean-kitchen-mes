"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/shared/utils";

export interface PageTabItem {
  value: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
}

interface PageTabsProps {
  tabs: PageTabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * 一级页签：一个页面下承载多份列表（如库存的当前库存 / 出库单 / 流水）。
 * 选中态沿用侧栏磁贴语言：浅橙底 + 内高光 + 轻投影；二级筛选请用 SkeuSegmented。
 */
export function PageTabs({
  tabs,
  value,
  onChange,
  className,
  ariaLabel = "页面视图",
}: PageTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("skeu-page-tabs", className)}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => onChange(tab.value)}
            className={cn("skeu-page-tab", active && "skeu-page-tab-active")}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span className="skeu-page-tab-count">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
