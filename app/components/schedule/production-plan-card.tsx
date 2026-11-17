"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMonthDay, getWeekDay } from "@/lib/shared/date-format";
import type { ProductionPlanListItem } from "@/app/components/schedule/list-types";

interface ProductionPlanCardProps {
  item: ProductionPlanListItem;
  busy?: boolean;
  /** 只读角色（如业务运营）不渲染写操作，只保留查看 */
  canWrite?: boolean;
  onOpen: () => void;
  onActivate: () => void;
  onComplete: () => void;
}

export function ProductionPlanCard({
  item,
  busy = false,
  canWrite = false,
  onOpen,
  onActivate,
  onComplete,
}: ProductionPlanCardProps) {
  const operator = item.operatorName || item.operator || "—";

  return (
    <Card
      className="cursor-pointer gap-0 py-0 transition-colors hover:border-primary/40"
      onClick={onOpen}
    >
      <CardContent className="space-y-2.5 p-4">
        <h3 className="text-base font-semibold leading-snug">{item.title}</h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>
            <b className="font-mono font-semibold">{item.scheduleCount}</b>
            <span className="ml-1 text-muted-foreground">张排程</span>
          </span>
          {item.selfOrderCount > 0 && (
            <span>
              <b className="font-mono font-semibold">{item.selfOrderCount}</b>
              <span className="ml-1 text-muted-foreground">张内部生产</span>
            </span>
          )}
          <span className="text-muted-foreground">
            {formatMonthDay(item.planDate)} {getWeekDay(item.planDate)}
          </span>
        </div>

        <div
          className="flex items-center justify-between gap-2 pt-1"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="text-xs text-muted-foreground">制单人 {operator}</span>

          {!canWrite && (
            <Button variant="outline" size="sm" onClick={onOpen}>
              查看详情
            </Button>
          )}
          {canWrite && item.status === "待生效" && (
            <Button size="sm" onClick={onActivate} disabled={busy}>
              确认生产计划
            </Button>
          )}
          {canWrite && item.status === "进行中" && (
            <Button size="sm" onClick={onComplete} disabled={busy}>
              完成生产
            </Button>
          )}
          {canWrite && item.status === "已完成" && (
            <Button variant="outline" size="sm" onClick={onOpen} disabled={busy}>
              查看详情
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
