"use client";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, inventoryStatusToVariant } from "@/app/components/status-badge";
import { formatRelativeTime, formatNumber, cn } from "@/lib/utils";

export interface InventoryItemWithDetail {
  id: number;
  sourceId: number;
  name: string;
  code: string;
  l2Code?: string;
  l1Name?: string;
  l2Name?: string;
  currentQty: number;
  unit: string;
  updatedAt: string;
  alias?: string | null;
  purchaseSpec?: string | null;
  purchaseUnit?: string | null;
  stockUnit?: string | null;
  latestRefPrice?: number | null;
  season?: string | null;
  storage?: string | null;
}

type HealthStatus = "充足" | "正常" | "低库存";

function getHealthStatus(qty: number): HealthStatus {
  if (qty >= 10) return "充足";
  if (qty >= 5) return "正常";
  return "低库存";
}

function getHealthBorderColor(status: HealthStatus): string {
  switch (status) {
    case "充足":
      return "border-success";
    case "正常":
      return "border-warning";
    case "低库存":
      return "border-destructive";
  }
}

interface IngredientCardProps {
  item: InventoryItemWithDetail;
  className?: string;
}

export function IngredientCard({ item, className }: IngredientCardProps) {
  const status = getHealthStatus(item.currentQty);

  const renderValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return "—";
    return value;
  };

  return (
    <div className={cn("group relative", className)}>
      <Card
        className={cn(
          "border-l-4 transition-shadow duration-200 hover:shadow-md",
          getHealthBorderColor(status)
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-medium text-foreground truncate">
              {item.name}
            </h3>
            <StatusBadge
              variant={inventoryStatusToVariant(status)}
              status={status}
              size="sm"
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">
              {formatNumber(item.currentQty)}
            </span>
            <span className="text-sm text-muted-foreground">{item.unit}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            更新于 {formatRelativeTime(item.updatedAt)}
          </p>
        </CardContent>
      </Card>

      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2.5 w-[320px] max-w-[90vw] -translate-x-1/2 opacity-0 invisible transition-all duration-200 delay-200 group-hover:opacity-100 group-hover:visible">
        <div className="rounded-lg border bg-card p-4 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-semibold text-foreground">{item.name}</span>
            <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
              {item.code}
            </span>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <TooltipRow label="名称" value={item.name} />
            <TooltipRow label="别名" value={renderValue(item.alias)} />
            <TooltipRow label="采购规格" value={renderValue(item.purchaseSpec)} />
            <TooltipRow label="采购单位" value={renderValue(item.purchaseUnit)} />
            <TooltipRow label="库存单位" value={renderValue(item.stockUnit)} />
            <TooltipRow
              label="最新参考价"
              value={
                item.latestRefPrice != null
                  ? `¥${formatNumber(Number(item.latestRefPrice))}`
                  : undefined
              }
            />
            <TooltipRow label="季节" value={renderValue(item.season)} />
            <TooltipRow label="储存方式" value={renderValue(item.storage)} />
            <TooltipRow label="二级分类" value={renderValue(item.l2Name)} />
          </div>
        </div>
        <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 rotate-45 w-2.5 h-2.5 bg-card border-r border-b"></div>
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right truncate">{value}</span>
    </div>
  );
}

export function IngredientCardPlaceholder({ className }: { className?: string }) {
  return (
    <Card className={cn("border-l-4 border-muted", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="h-5 w-12 rounded bg-muted" />
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <div className="h-8 w-16 rounded bg-muted" />
          <div className="h-4 w-8 rounded bg-muted" />
        </div>
        <div className="mt-2 h-3 w-20 rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
