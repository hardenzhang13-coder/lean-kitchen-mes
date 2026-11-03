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
      className={cn("h-10 w-10", className)}
      role="img"
      aria-label="精益厨房"
    >
      <rect width="40" height="40" rx="8" fill="var(--primary)" />
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
