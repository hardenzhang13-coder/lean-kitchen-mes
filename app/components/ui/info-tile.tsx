import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/shared/utils";

interface InfoTileProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  className?: string;
}

export function InfoTile({
  icon: Icon,
  label,
  value,
  helper,
  className,
}: InfoTileProps) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border bg-card p-4 shadow-sm ring-1 ring-foreground/5",
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="truncate font-semibold text-foreground" title={typeof value === "string" ? value : undefined}>
        {value}
      </div>
      {helper && (
        <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
      )}
    </div>
  );
}
