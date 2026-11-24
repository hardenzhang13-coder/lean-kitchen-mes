"use client";

import { getSeasoningTypeOption } from "@/lib/shared/seasoning-type";
import { cn } from "@/lib/shared/utils";

interface SeasoningTypeTagProps {
  type?: string | null;
  className?: string;
}

export function SeasoningTypeTag({ type, className }: SeasoningTypeTagProps) {
  const option = getSeasoningTypeOption(type);
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
