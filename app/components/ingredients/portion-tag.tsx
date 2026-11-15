"use client";

import { cn } from "@/lib/shared/utils";
import { getPortionOption } from "@/lib/shared/portion-scale";

/** 份量标签的柔和底色映射：与菜品列表的份量徽标同一套语义。 */
const PORTION_TAG_CLASSES: Record<string, string> = {
  小碗菜: "bg-sky-100 text-sky-700",
  "小碗菜·10份": "bg-cyan-100 text-cyan-700",
  "社区·2份": "bg-amber-100 text-amber-700",
  "社区·3份": "bg-emerald-100 text-emerald-700",
  "社区·4份": "bg-violet-100 text-violet-700",
};

interface PortionTagProps {
  /** 份量枚举值；为空或非法值显示占位符 */
  portion?: string | null;
  className?: string;
  /** 无值时的占位文案 */
  emptyText?: string;
}

/**
 * 份量标签：净料/小料档案与菜品 BOM 选择器共用。
 * 文本取枚举短值，说明文案（小碗菜等价份数）放在 title 上。
 */
export function PortionTag({
  portion,
  className,
  emptyText = "—",
}: PortionTagProps) {
  const option = getPortionOption(portion);
  if (!option) {
    return (
      <span className={cn("text-muted-foreground", className)}>{emptyText}</span>
    );
  }

  return (
    <span
      title={option.description}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        PORTION_TAG_CLASSES[option.value] ??
          "bg-muted text-muted-foreground",
        className
      )}
    >
      {option.label}
    </span>
  );
}