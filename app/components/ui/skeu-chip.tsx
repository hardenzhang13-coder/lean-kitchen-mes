"use client";

import { cn } from "@/lib/shared/utils";

/**
 * 有色枚举标签与选择片：分类这类「取值本身就是识别色」的短枚举共用一套色板。
 * 列表只读用 `SkeuChipTag`，表单选择用 `SkeuChipSelect`，两者颜色一一对应。
 */
export type ChipTone =
  | "orange"
  | "blue"
  | "violet"
  | "slate"
  | "green"
  | "amber"
  | "red";

const TONES: Record<ChipTone, { bg: string; ink: string; dot: string }> = {
  orange: { bg: "var(--tag-dry-bg)", ink: "var(--tag-dry)", dot: "var(--tag-dry)" },
  blue: { bg: "var(--tag-aqu-bg)", ink: "var(--tag-aqu)", dot: "var(--tag-aqu)" },
  violet: { bg: "var(--tag-prc-bg)", ink: "var(--tag-prc)", dot: "var(--tag-prc)" },
  slate: { bg: "var(--tag-gra-bg)", ink: "var(--tag-gra)", dot: "var(--tag-gra)" },
  green: { bg: "var(--tag-veg-bg)", ink: "var(--tag-veg)", dot: "var(--tag-veg)" },
  amber: { bg: "var(--tag-pou-bg)", ink: "var(--tag-pou)", dot: "var(--tag-pou)" },
  red: { bg: "var(--tag-mea-bg)", ink: "var(--tag-mea)", dot: "var(--tag-mea)" },
};

export interface ChipOption<T extends string = string> {
  value: T;
  label: string;
  tone: ChipTone;
}

export function SkeuChipTag({
  tone,
  children,
  title,
  className,
}: {
  tone: ChipTone;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      title={title}
      className={cn(
        "skeu-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        className
      )}
      style={{ backgroundColor: t.bg, color: t.ink }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: t.dot }}
      />
      {children}
    </span>
  );
}

export function SkeuChipSelect<T extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ChipOption<T>[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        const t = TONES[option.tone];
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-[var(--sk-radius-sm)] border px-4 text-sm transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sk-focus)]",
              active ? "font-semibold" : "font-medium hover:-translate-y-px"
            )}
            style={{
              color: t.ink,
              backgroundColor: t.bg,
              backgroundImage: active
                ? `linear-gradient(180deg, color-mix(in oklab, ${t.bg}, #ffffff 60%), ${t.bg})`
                : `linear-gradient(180deg, #ffffff, ${t.bg})`,
              borderColor: `color-mix(in oklab, ${t.ink} ${active ? 42 : 18}%, transparent)`,
              boxShadow: active
                ? "inset 0 2px 4px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.45)"
                : "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.08)",
            }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: t.dot }}
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
