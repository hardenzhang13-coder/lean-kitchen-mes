"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChefHat } from "lucide-react";
import { StatusBadge } from "@/app/components/status-badge";

interface DishCardProps {
  code: string;
  name: string;
  intro?: string | null;
  categoryName: string;
  cuisine?: string | null;
  meatType?: string | null;
  portion?: string | null;
  cost?: number | null;
  status?: string;
  onClick: () => void;
}

export function DishCard({
  code,
  name,
  intro,
  categoryName,
  cuisine,
  meatType,
  portion,
  cost,
  status,
  onClick,
}: DishCardProps) {
  const statusTextMap: Record<string, string> = {
    published: "已发布",
    draft: "草稿",
    pending: "待发布",
  };
  const statusText = status ? statusTextMap[status] : null;

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer group overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-none bg-card"
    >
      <CardContent className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <ChefHat className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">{name}</h3>
              <p className="text-xs text-muted-foreground">{code}</p>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {categoryName}
          </Badge>
        </div>

        {intro && (
          <p className="text-sm text-muted-foreground line-clamp-2">{intro}</p>
        )}

        {/* 状态 + 标签 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusText && (
            <StatusBadge status={statusText} />
          )}
          {cuisine && (
            <span className="inline-flex items-center text-xs bg-muted rounded-full px-2 py-0.5">
              {cuisine}
            </span>
          )}
          {meatType && (
            <span className="inline-flex items-center text-xs bg-muted rounded-full px-2 py-0.5">
              {meatType}
            </span>
          )}
          {portion && (
            <span className="inline-flex items-center text-xs bg-muted rounded-full px-2 py-0.5">
              {portion}
            </span>
          )}
          {cost != null && (
            <span className="inline-flex items-center text-xs text-[var(--success)] bg-[var(--success-muted)] rounded-full px-2 py-0.5">
              ¥{Number(cost).toFixed(2)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
