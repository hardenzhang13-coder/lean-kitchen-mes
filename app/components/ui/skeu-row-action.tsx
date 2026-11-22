"use client";

import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/shared/utils";

/**
 * 行内纯图标操作按钮（v008 icon-btn 规格）：40×40 圆角 9px，悬浮出深色提示气泡。
 * 只用于上移 / 下移这类低频动作；带文字的动作走 SkeuActionButton。
 */
export function SkeuIconAction({
  label,
  tip,
  icon,
  disabled = false,
  onClick,
  className,
}: {
  label: string;
  tip?: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  if (!tip) {
    return (
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn("skeu-icon-btn", className)}
      >
        {icon}
      </button>
    );
  }

  return (
    <Tooltip>
      {/* 用 render 保留原生 button：base-ui 的 TooltipTrigger 会吞掉 disabled 属性，
          导致「首条不可上移」这类限制失效、按钮仍可点击 */}
      <TooltipTrigger
        render={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cn("skeu-icon-btn", className)}
          >
            {icon}
          </button>
        )}
      />
      <TooltipContent side="bottom" align="end" sideOffset={6}>
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

export type SkeuActionTone =
  | "default"
  | "danger"
  | "warn"
  | "ok"
  | "soft"
  | "fill"
  | "primary";

/**
 * 行内带文字操作按钮（v008 act-btn 规格）：34px 高、12px 文字、14px 图标。
 * 层级由低到高：default → soft（描边）→ fill（浅橙实底）→ primary（浅橙底 + 橙描边）。
 */
export function SkeuActionButton({
  label,
  tone = "default",
  icon,
  onClick,
  disabled = false,
  className,
}: {
  label: string;
  tone?: SkeuActionTone;
  icon?: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "skeu-act-btn",
        tone !== "default" && tone,
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}