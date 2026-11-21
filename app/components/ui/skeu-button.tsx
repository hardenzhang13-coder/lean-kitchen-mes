"use client";

// 直接用 base-ui 原语：避免带上 shadcn Button 的 cva 杂类
// （透明 border、bg-clip-padding、hover:bg-primary/80 等会干扰拟物表层）
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@/lib/shared/utils";

export type SkeuButtonVariant =
  | "primary"
  | "outline"
  | "secondary"
  | "ghost"
  | "danger";
export type SkeuButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANT_CLASS: Record<SkeuButtonVariant, string> = {
  primary: "skeu-btn-primary",
  outline: "skeu-btn-outline",
  secondary: "skeu-btn-secondary",
  ghost: "skeu-btn-ghost",
  danger: "skeu-btn-danger",
};

const SIZE_CLASS: Record<SkeuButtonSize, string> = {
  sm: "h-9 gap-1.5 px-[9px] text-[13px]",
  md: "h-11 gap-2 px-[18px]",
  lg: "h-11 gap-2 px-[18px]",
  icon: "size-11",
  "icon-sm": "size-9",
};

export type SkeuButtonProps = Omit<
  React.ComponentProps<typeof ButtonPrimitive>,
  "variant" | "size"
> & {
  variant?: SkeuButtonVariant;
  size?: SkeuButtonSize;
};

/**
 * 轻拟物按钮：在 shadcn Button 之上叠加拟物表层（渐变 / 顶部高光 / 按压内凹）。
 * 视觉定义集中在 app/globals.css 的 .skeu-btn-* 类，业务页面不写像素。
 */
export function SkeuButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: SkeuButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="skeu-button"
      className={cn(
        "skeu-btn inline-flex shrink-0 items-center justify-center rounded-[10px] text-sm font-semibold whitespace-nowrap outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className
      )}
      {...props}
    />
  );
}