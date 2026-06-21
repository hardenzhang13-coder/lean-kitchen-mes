"use client";

import { SkeletonTable } from "@/app/components/skeleton-table";

interface LoadingStateProps {
  type?: "table" | "card-grid" | "page" | "inline";
  rows?: number;
  cols?: number;
  cardCount?: number;
  className?: string;
}

export function LoadingState({
  type = "table",
  rows = 8,
  cols = 6,
  cardCount = 4,
  className,
}: LoadingStateProps) {
  if (type === "table") {
    return <SkeletonTable rows={rows} cols={cols} className={className} />;
  }

  if (type === "card-grid") {
    return (
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${
          className || ""
        }`}
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card ring-1 ring-foreground/5 p-5 space-y-3 animate-pulse"
          >
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-2/3 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "inline") {
    return (
      <div className={`animate-pulse ${className || ""}`}>
        <div className="h-4 w-full bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className || ""}`}>
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="h-40 bg-muted rounded-lg animate-pulse" />
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}
