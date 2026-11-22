"use client";

import { cn } from "@/lib/shared/utils";

type MeatTone = { bg: string; dot: string };

const MEAT_TONES: Record<string, MeatTone> = {
  荤菜: { bg: "var(--meat-bg)", dot: "var(--meat-dot)" },
  小荤菜: {
    bg: "var(--meat-mixed-bg)",
    dot: "var(--meat-mixed-dot)",
  },
  素菜: { bg: "var(--veg-bg)", dot: "var(--veg-dot)" },
};

interface MeatTypeTagProps {
  type?: string | null;
  className?: string;
}

/** 菜品荤素标签：荤菜 / 小荤菜 / 素菜，与份量胶囊同一套拟物色板。
 * 文字统一深墨（--capsule-ink），色相识别靠底色 + 圆点。 */
export function MeatTypeTag({ type, className }: MeatTypeTagProps) {
  if (!type) {
    return (
      <span className={cn("text-muted-foreground/60 select-none", className)}>
        –
      </span>
    );
  }

  const tone = MEAT_TONES[type] ?? {
    bg: "var(--muted)",
    dot: "var(--muted-foreground)",
  };

  return (
    <span
      className={cn(
        "skeu-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        className
      )}
      style={{ backgroundColor: tone.bg, color: "var(--capsule-ink)" }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tone.dot }}
      />
      {type}
    </span>
  );
}
