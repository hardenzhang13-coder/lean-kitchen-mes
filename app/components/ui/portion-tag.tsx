"use client";

import { cn } from "@/lib/shared/utils";
import { getPortionOption } from "@/lib/shared/portion-scale";
import { usePortionProfiles } from "@/lib/client/use-portion-profiles";

/**
 * 份量标签：净料/小料档案与菜品 BOM 选择器共用。
 *
 * 份量取值唯一真源是份量档案表（设置模块「份量」）；本组件只负责渲染。
 * 色板按档案场景映射（单人份 / 社区 / 团餐食堂），未知场景走 muted 兜底；
 * 档案接口不可达时按历史标签前缀兜底。
 * 文字统一深墨（--capsule-ink），色相识别靠底色 + 圆点，避免与主色橙冲突。
 */

type PortionTone = {
  bg: string;
  dot: string;
};

const SINGLE_TONE: PortionTone = {
  bg: "var(--portion-single-bg)",
  dot: "var(--portion-single-dot)",
};
const COMMUNITY_TONE: PortionTone = {
  bg: "var(--portion-comm1-bg)",
  dot: "var(--portion-comm1-dot)",
};
const CANTEEN_TONE: PortionTone = {
  bg: "var(--portion-canteen-bg)",
  dot: "var(--portion-canteen-dot)",
};
const MUTED_TONE: PortionTone = {
  bg: "var(--muted)",
  dot: "var(--muted-foreground)",
};

interface PortionTagProps {
  /** 份量档案落库标签；为空或未知值显示占位符 */
  portion?: string | null;
  className?: string;
  /** 无值时的占位文案 */
  emptyText?: string;
}

export function PortionTag({
  portion,
  className,
  emptyText = "–",
}: PortionTagProps) {
  const { profiles } = usePortionProfiles();
  const option = getPortionOption(portion, profiles);
  if (!option) {
    return (
      <span className={cn("text-muted-foreground/60", className)}>
        {emptyText}
      </span>
    );
  }

  const row = profiles?.find((p) => p.portion === portion);
  let tone = MUTED_TONE;
  if (row) {
    if (row.isBase) tone = SINGLE_TONE;
    else if (row.scenario.includes("社区")) tone = COMMUNITY_TONE;
    else if (row.scenario.includes("团餐") || row.scenario.includes("食堂"))
      tone = CANTEEN_TONE;
  } else if (portion === "单人份" || portion === "小碗菜") {
    tone = SINGLE_TONE;
  } else if (portion?.startsWith("社区")) {
    tone = COMMUNITY_TONE;
  } else if (portion === "小碗菜·10份") {
    tone = CANTEEN_TONE;
  }

  return (
    <span
      title={option.description}
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
      {option.label}
    </span>
  );
}
