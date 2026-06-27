"use client";

import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  unit?: string;
  variant?: "default" | "destructive";
  footer?: React.ReactNode;
  className?: string;
}

export function KpiCard({
  icon: Icon,
  value,
  label,
  unit,
  variant = "default",
  footer,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("flex flex-row items-center gap-4", className)}>
      <CardContent className="p-5 flex items-center gap-4 w-full">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            variant === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                "text-3xl font-bold tracking-tight",
                variant === "destructive" ? "text-destructive" : "text-foreground"
              )}
            >
              {value}
            </span>
            {unit && (
              <span className="text-sm text-muted-foreground">{unit}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          {footer && (
            <p className="text-xs text-muted-foreground truncate">{footer}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
