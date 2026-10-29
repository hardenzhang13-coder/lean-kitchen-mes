"use client";

import { ReactNode } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  className?: string;
}

export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "搜索...",
  onReset,
  hasFilters = false,
  children,
  className = "",
}: ListToolbarProps) {
  const showReset = searchValue.trim() !== "" || hasFilters;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full"
        />
      </div>
      {children}
      {showReset && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          重置
        </Button>
      )}
    </div>
  );
}
