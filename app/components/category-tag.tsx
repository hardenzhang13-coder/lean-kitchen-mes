"use client";

import { cn } from "@/lib/utils";

const tagVarMap: Record<string, { fg: string; bg: string }> = {
  // 食材分类
  VEG: { fg: "var(--tag-veg)", bg: "var(--tag-veg-bg)" },
  MEA: { fg: "var(--tag-mea)", bg: "var(--tag-mea-bg)" },
  AQU: { fg: "var(--tag-aqu)", bg: "var(--tag-aqu-bg)" },
  POU: { fg: "var(--tag-pou)", bg: "var(--tag-pou-bg)" },
  DRY: { fg: "var(--tag-dry)", bg: "var(--tag-dry-bg)" },
  BEA: { fg: "var(--tag-bea)", bg: "var(--tag-bea-bg)" },
  PRC: { fg: "var(--tag-prc)", bg: "var(--tag-prc-bg)" },
  GRA: { fg: "var(--tag-gra)", bg: "var(--tag-gra-bg)" },
  SEA: { fg: "var(--tag-sea)", bg: "var(--tag-sea-bg)" },
  "SEA-SEA": { fg: "var(--tag-sea)", bg: "var(--tag-sea-bg)" },
  MIN: { fg: "var(--tag-prc)", bg: "var(--tag-prc-bg)" },
  // 菜品分类
  PORK: { fg: "var(--tag-mea)", bg: "var(--tag-mea-bg)" },
  BEEF: { fg: "var(--tag-mea)", bg: "var(--tag-mea-bg)" },
  MUTTON: { fg: "var(--tag-mea)", bg: "var(--tag-mea-bg)" },
  CHICKEN: { fg: "var(--tag-pou)", bg: "var(--tag-pou-bg)" },
  DUCK: { fg: "var(--tag-pou)", bg: "var(--tag-pou-bg)" },
  EGG: { fg: "var(--tag-pou)", bg: "var(--tag-pou-bg)" },
  PERCH: { fg: "var(--tag-aqu)", bg: "var(--tag-aqu-bg)" },
  GRASS: { fg: "var(--tag-aqu)", bg: "var(--tag-aqu-bg)" },
  CRUCIAN: { fg: "var(--tag-aqu)", bg: "var(--tag-aqu-bg)" },
  WUCHANG: { fg: "var(--tag-aqu)", bg: "var(--tag-aqu-bg)" },
  BLACK: { fg: "var(--tag-aqu)", bg: "var(--tag-aqu-bg)" },
  HAIRTAIL: { fg: "var(--tag-aqu)", bg: "var(--tag-aqu-bg)" },
  YELLOW: { fg: "var(--tag-aqu)", bg: "var(--tag-aqu-bg)" },
  SHRIMP: { fg: "var(--tag-aqu)", bg: "var(--tag-aqu-bg)" },
  SPECIAL: { fg: "var(--tag-prc)", bg: "var(--tag-prc-bg)" },
  TOFU: { fg: "var(--tag-bea)", bg: "var(--tag-bea-bg)" },
  MUSHROOM: { fg: "var(--tag-veg)", bg: "var(--tag-veg-bg)" },
  VEGETABLE: { fg: "var(--tag-veg)", bg: "var(--tag-veg-bg)" },
  SOUP: { fg: "var(--tag-dry)", bg: "var(--tag-dry-bg)" },
};

interface CategoryTagProps {
  l2Code?: string | null;
  l1Code?: string | null;
  name?: string | null;
  className?: string;
}

export function CategoryTag({ l2Code, l1Code, name, className }: CategoryTagProps) {
  const code = l2Code || l1Code || "";
  const style = tagVarMap[code] || tagVarMap[code.split("-")[0]] || { fg: "var(--muted-foreground)", bg: "var(--muted)" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
      style={{ color: style.fg, backgroundColor: style.bg }}
    >
      {name || code || "—"}
    </span>
  );
}
