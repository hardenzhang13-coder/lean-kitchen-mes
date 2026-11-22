"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/shared/utils";

type SkeuComboboxTriggerProps = {
  /** 已选显示文案；为空时显示 placeholder */
  label?: React.ReactNode;
  placeholder?: string;
  className?: string;
  /** 选择弹层的展开状态，用于 combobox 的 aria 属性 */
  open?: boolean;
  /** 触发器右侧附加内容（如清除按钮），位于箭头左侧 */
  children?: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/**
 * 拟物选择框触发器标准件：与 .skeu-input 同高同表面的内凹控件，
 * 用于「点击打开选择弹窗」型字段（级联 / 磁贴 / 表格选择器）。
 * 下拉项浮层由各选择器自带的 Dialog 负责，本组件只定义触发器。
 */
export function SkeuComboboxTrigger({
  label,
  placeholder = "请选择",
  className,
  disabled,
  open,
  children,
  ...props
}: SkeuComboboxTriggerProps) {
  const panelId = useId();
  return (
    <button
      type="button"
      role="combobox"
      disabled={disabled}
      aria-expanded={open ?? false}
      aria-controls={panelId}
      className={cn(
        "skeu-trigger flex w-full items-center justify-between gap-2 text-left font-normal",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "truncate",
          label != null && label !== "" ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label != null && label !== "" ? label : placeholder}
      </span>
      <span className="flex items-center gap-1 ml-2 shrink-0">
        {children}
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </span>
    </button>
  );
}
