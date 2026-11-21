import { cn } from "@/lib/shared/utils";

/**
 * 精益厨房品牌 Logo。
 * 橙色圆角方块内的白色同心环 + 中心精准点，
 * 呼应「秩序的温度」视觉主张，与登录页细环装饰同源。
 * 通过 className 控制尺寸（默认 40px）。
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn(
        "h-10 w-10 rounded-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_3px_8px_rgba(234,88,12,0.28)]",
        className
      )}
      role="img"
      aria-label="精益厨房"
    >
      <defs>
        <linearGradient id="skeu-brand-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0813C" />
          <stop offset="100%" stopColor="#E05A1E" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="8" fill="url(#skeu-brand-gradient)" />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="7.5"
        fill="none"
        stroke="rgba(255,255,255,0.40)"
        strokeWidth="1"
      />
      <circle
        cx="20"
        cy="20"
        r="11.5"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      <circle
        cx="20"
        cy="20"
        r="7"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      <circle cx="20" cy="20" r="2.8" fill="var(--primary-foreground)" />
    </svg>
  );
}
