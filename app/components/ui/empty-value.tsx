import { cn } from "@/lib/shared/utils";

/**
 * 列表 / 详情中的空值占位符（唯一实现）：短横线 + 低对比。
 * 各模块不再自建 `—` 文本，保证全系统占位样式一致。
 */
export function EmptyValue({
  title,
  className,
}: {
  /** 悬浮提示，用于「未填写原因」等场景 */
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn("select-none text-muted-foreground/40", className)}
    >
      –
    </span>
  );
}
