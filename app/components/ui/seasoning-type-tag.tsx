"use client";

import { getSeasoningProductTypeOption } from "@/lib/shared/seasoning-product";
import { cn } from "@/lib/shared/utils";

interface SeasoningTypeTagProps {
  /** 产物类型：单品调料/复合调料/成品酱料（SeasoningProduct.productType） */
  type?: string | null;
  className?: string;
}

export function SeasoningTypeTag({ type, className }: SeasoningTypeTagProps) {
  const option = getSeasoningProductTypeOption(type);
  if (!option) return null;

  return (
    <span
      className={cn(
        "skeu-badge inline-flex items-center px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
      style={{ color: "var(--tag-sea)", backgroundColor: "var(--tag-sea-bg)" }}
    >
      {option.label}
    </span>
  );
}
