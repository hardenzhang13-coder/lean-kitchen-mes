"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type TileGroupOption = {
  value: string;
  label: string;
};

interface TileGroupProps {
  options: TileGroupOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function TileGroup({
  options,
  value,
  onChange,
  className,
  disabled = false,
}: TileGroupProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
              "hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring",
              active
                ? "border-primary bg-primary/5 text-primary hover:bg-primary/10"
                : "border-input bg-transparent text-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {active && <Check className="h-3.5 w-3.5 text-primary" />}
            <span className="font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
