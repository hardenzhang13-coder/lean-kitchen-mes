"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/shared/utils";

export interface SkeuSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * 轻拟物搜索框：内凹底 + 无聚焦发光，有内容时右侧出现圆形清除按钮。
 */
export function SkeuSearch({
  value,
  onChange,
  placeholder = "搜索...",
  className,
  ...rest
}: SkeuSearchProps) {
  return (
    <div className={cn("relative min-w-[200px] max-w-sm flex-1", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="skeu-input h-11 w-full rounded-[10px] border pr-10 pl-9 text-sm outline-none transition-colors duration-150 placeholder:text-muted-foreground"
        {...rest}
      />
      {value ? (
        <button
          type="button"
          aria-label="清除搜索"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}