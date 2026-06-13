"use client";

import { cn } from "@/lib/utils";

const colorMap: Record<string, { bg: string; text: string }> = {
  VEG: { bg: "bg-green-100", text: "text-green-700" },
  MEA: { bg: "bg-red-100", text: "text-red-700" },
  AQU: { bg: "bg-blue-100", text: "text-blue-700" },
  POU: { bg: "bg-amber-100", text: "text-amber-700" },
  DRY: { bg: "bg-orange-100", text: "text-orange-700" },
  BEA: { bg: "bg-cyan-100", text: "text-cyan-700" },
  PRC: { bg: "bg-purple-100", text: "text-purple-700" },
  GRA: { bg: "bg-slate-100", text: "text-slate-700" },
  SEA: { bg: "bg-pink-100", text: "text-pink-700" },
  "SEA-SEA": { bg: "bg-pink-100", text: "text-pink-700" },
};

interface CategoryTagProps {
  l2Code?: string | null;
  l1Code?: string | null;
  name?: string | null;
  className?: string;
}

export function CategoryTag({ l2Code, l1Code, name, className }: CategoryTagProps) {
  const code = l2Code || l1Code || "";
  const style = colorMap[code] || colorMap[code.split("-")[0]] || { bg: "bg-muted", text: "text-muted-foreground" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        style.bg,
        style.text,
        className
      )}
    >
      {name || code || "—"}
    </span>
  );
}
