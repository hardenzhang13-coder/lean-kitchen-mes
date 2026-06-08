"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChefHat, Utensils } from "lucide-react";

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
  const statusMap: Record<string, { text: string; className: string }> = {
    published: { text: "已发布", className: "bg-green-100 text-green-700" },
    draft: { text: "草稿", className: "bg-gray-100 text-gray-700" },
    pending: { text: "待发布", className: "bg-amber-100 text-amber-700" },
  };
  const st = status ? statusMap[status] : null;

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
          {st && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${st.className}`}>
              {st.text}
            </span>
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
            <span className="inline-flex items-center text-xs text-green-600 bg-green-50 rounded-full px-2 py-0.5">
              ¥{Number(cost).toFixed(2)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
