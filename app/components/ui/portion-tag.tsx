"use client";

import { cn } from "@/lib/shared/utils";
import { getPortionOption } from "@/lib/shared/portion-scale";

/**
 * 份量标签：净料/小料档案与菜品 BOM 选择器共用。
 *
 * 份量枚举的唯一真源是 `lib/shared/portion-scale.ts`；本组件只负责渲染，
 * 不在这里硬编码枚举值。新增份量取值时需同步补色板。
 */

type PortionTone = {
  bg: string;
  ink: string;
  dot: string;
};

const PORTION_TONES: Record<string, PortionTone> = {
  小碗菜: {
    bg: "var(--portion-single-bg)",
    ink: "var(--portion-single-ink)",
    dot: "var(--portion-single-dot)",
  },
  "小碗菜·10份": {
    bg: "var(--portion-canteen-bg)",
    ink: "var(--portion-canteen-ink)",
    dot: "var(--portion-canteen-dot)",
  },
  "社区·1份": {
    bg: "var(--portion-comm1-bg)",
    ink: "var(--portion-comm1-ink)",
    dot: "var(--portion-comm1-dot)",
  },
  "社区·2份": {
    bg: "var(--portion-comm2-bg)",
    ink: "var(--portion-comm2-ink)",
    dot: "var(--portion-comm2-dot)",
  },
  "社区·3份": {
    bg: "var(--portion-comm3-bg)",
    ink: "var(--portion-comm3-ink)",
    dot: "var(--portion-comm3-dot)",
  },
  "社区·4份": {
    bg: "var(--portion-comm4-bg)",
    ink: "var(--portion-comm4-ink)",
    dot: "var(--portion-comm4-dot)",
  },
};

const FALLBACK_TONE: PortionTone = {
  bg: "var(--muted)",
  ink: "var(--muted-foreground)",
  dot: "var(--muted-foreground)",
};

interface PortionTagProps {
  /** 份量枚举值；为空或非法值显示占位符 */
  portion?: string | null;
  className?: string;
  /** 无值时的占位文案 */
  emptyText?: string;
}

export function PortionTag({
  portion,
  className,
  emptyText = "–",
}: PortionTagProps) {
  const option = getPortionOption(portion);
  if (!option) {
    return (
      <span className={cn("text-muted-foreground/60", className)}>
        {emptyText}
      </span>
    );
  }

  const tone = PORTION_TONES[option.value] ?? FALLBACK_TONE;

  return (
    <span
      title={option.description}
      className={cn(
        "skeu-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        className
      )}
      style={{ backgroundColor: tone.bg, color: tone.ink }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tone.dot }}
      />
      {option.label}
    </span>
  );
}
