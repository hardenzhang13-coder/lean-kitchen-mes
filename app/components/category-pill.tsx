"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryPillProps {
  name: string;
  icon: LucideIcon;
  count: number;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export function CategoryPill({
  name,
  icon: Icon,
  count,
  active = false,
  disabled = false,
  onClick,
  className,
}: CategoryPillProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-all duration-200 ease-default w-full",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-foreground hover:bg-muted/60",
        disabled && !active && "opacity-50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="font-medium truncate">{name}</span>
      <span
        className={cn(
          "ml-auto shrink-0 text-xs",
          active ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        {count} 种
      </span>
    </button>
  );
}
