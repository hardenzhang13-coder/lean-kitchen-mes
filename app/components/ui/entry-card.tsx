import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/shared/utils";

interface EntryCardProps {
  href: string;
  label: string;
  /** 卡片说明文案（一行，超长截断） */
  desc?: string;
  icon: LucideIcon;
  /**
   * iOS 风格渐变磁贴配色：由调用方传入完整类串
   * （渐变底 + 静置彩色投影 + hover 投影增强），组件只提供结构与动效。
   */
  tileClass?: string;
  className?: string;
}

/**
 * 设置首页入口卡（iOS 拟物化语言）。
 *
 * - 卡片：暖白纸面、14px 圆角、发丝描边；厚重的悬浮——
 *   卡体几乎不离位，靠阴影下潜表达重量，active 时阴影收紧落地。
 * - 磁贴：44px 连续圆角渐变色块（白描 glyph + 顶部高光），
 *   hover 微放大 + 投影增强，active 按压缩小——实体按钮手感。
 * - 色彩只属于磁贴，卡面保持中性纸面。
 */
export function EntryCard({
  href,
  label,
  desc,
  icon: Icon,
  tileClass,
  className,
}: EntryCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-[108px] items-center gap-3 rounded-[14px] border border-black/[0.06] bg-[linear-gradient(180deg,#ffffff_0%,#fcfbf9_100%)] p-3.5 pr-4",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_3px_12px_rgba(15,23,42,0.06)]",
        "transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        "hover:-translate-y-px hover:border-black/[0.09] hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_10px_24px_rgba(15,23,42,0.12)]",
        "active:translate-y-0 active:border-black/[0.09] active:shadow-[0_1px_3px_rgba(15,23,42,0.10)]",
        "focus-visible:border-[var(--sk-focus)] focus-visible:outline-none",
        className
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] text-white",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.40)]",
          "transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          "group-hover:scale-[1.04] group-active:scale-95",
          tileClass
        )}
      >
        <Icon
          className="h-[22px] w-[22px] [text-shadow:0_1px_1px_rgba(0,0,0,0.18)]"
          aria-hidden
        />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-semibold leading-snug text-foreground">
          {label}
        </span>
        {desc && (
          <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
            {desc}
          </span>
        )}
      </span>
    </Link>
  );
}
