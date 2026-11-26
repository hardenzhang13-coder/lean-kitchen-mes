"use client";

import { getSeasoningProductTypeOption } from "@/lib/shared/seasoning-product";
import { SkeuChipTag, type ChipTone } from "@/app/components/ui/skeu-chip";

interface SeasoningTypeTagProps {
  /** 产物类型：单品调料/复合调料/成品酱料（SeasoningProduct.productType） */
  type?: string | null;
  className?: string;
}

/** 三类调料各用一种色相，列表扫读时一眼可分 */
const TYPE_TONES: Record<string, ChipTone> = {
  单品调料: "amber",
  复合调料: "violet",
  成品酱料: "red",
};

export function SeasoningTypeTag({ type, className }: SeasoningTypeTagProps) {
  const option = getSeasoningProductTypeOption(type);
  if (!option) return null;

  return (
    <SkeuChipTag tone={TYPE_TONES[option.value] ?? "slate"} className={className}>
      {option.label}
    </SkeuChipTag>
  );
}
