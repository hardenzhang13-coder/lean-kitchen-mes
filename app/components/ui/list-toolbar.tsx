"use client";

import { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuSearch } from "@/app/components/ui/skeu-search";
import { cn } from "@/lib/shared/utils";

// 列表页表头标准工具栏：搜索框 + 筛选项 + 重置按钮。
// 用法：放在 Card > CardHeader.pb-3 内；其余筛选控件（Select/DatePicker/Tabs 等）作为 children 传入。
// 分页归位由各页在 onSearchChange / onReset 中自行调用 setPage(1) / setCurrentPage(1)。

interface ListToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** 重置全部筛选（含搜索），并将分页归位 */
  onReset: () => void;
  /** 除搜索外是否有生效中的筛选条件（用于控制重置按钮显隐） */
  hasFilters?: boolean;
  /** 其余筛选项 */
  children?: ReactNode;
  /** 筛选行最右侧的附加控件（如看板状态显隐） */
  trailing?: ReactNode;
  className?: string;
}

export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "搜索...",
  onReset,
  hasFilters = false,
  children,
  trailing,
  className,
}: ListToolbarProps) {
  const showReset = searchValue.trim() !== "" || hasFilters;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <SkeuSearch
        value={searchValue}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
      />
      {children}
      {showReset && (
        <SkeuButton variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          重置
        </SkeuButton>
      )}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}