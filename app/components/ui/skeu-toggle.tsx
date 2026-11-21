"use client";

import { cn } from "@/lib/shared/utils";

export interface SkeuToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** 开关左侧文案，调用方按状态传入（如 全部展开 / 全部收起） */
  label?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * 轻拟物拨动开关：内凹轨道 + 立体滑动圆钮。
 * 用于「整体展开 / 收起」这类有状态语义的开关，不挂原生 title 气泡。
 */
export function SkeuToggle({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  className,
  ...rest
}: SkeuToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-11 items-center gap-3 rounded-full border border-skeu-border-strong bg-[#f6f3ef] px-4 transition-[transform,box-shadow,background-color] duration-150 shadow-sk-raised hover:bg-[#efece6] active:translate-y-px active:shadow-sk-inset-strong disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...rest}
    >
      {label ? (
        <span className="text-[13px] font-semibold whitespace-nowrap">{label}</span>
      ) : null}
      <span className="relative block h-[26px] w-[46px] shrink-0 rounded-full bg-[#e7e2da] shadow-sk-inset-strong">
        <span
          className={cn(
            "absolute top-[3px] left-[3px] size-5 rounded-full bg-gradient-to-b from-white to-[#efece6] shadow-[0_1px_3px_rgba(15,23,42,0.28)] transition-[left,background-color,box-shadow] duration-200",
            checked &&
              "left-[23px] bg-gradient-to-b from-[#f0813c] to-[#e05a1e] shadow-[0_1px_3px_rgba(194,65,12,0.4)]"
          )}
        />
      </span>
    </button>
  );
}