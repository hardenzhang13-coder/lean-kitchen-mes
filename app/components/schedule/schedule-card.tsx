"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMonthDay, getWeekDay } from "@/lib/shared/date-format";
import type { ScheduleListItem } from "@/app/components/schedule/list-types";

interface ScheduleCardProps {
  item: ScheduleListItem;
  busy?: boolean;
  /** 只读角色（如业务运营）不渲染写操作，只保留查看 */
  canWrite?: boolean;
  onOpen: () => void;
  onActivate: () => void;
  onGotoPlan: (planId: number) => void;
}

export function ScheduleCard({
  item,
  busy = false,
  canWrite = false,
  onOpen,
  onActivate,
  onGotoPlan,
}: ScheduleCardProps) {
  const plan = item.productionPlan;
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
            <b className="font-mono font-semibold">{item.dishCount}</b>
            <span className="ml-1 text-muted-foreground">菜品</span>
          </span>
          <span>
            <b className="font-mono font-semibold">{item.totalQuantity}</b>
            <span className="ml-1 text-muted-foreground">份</span>
          </span>
          <span className="text-muted-foreground">
            {formatMonthDay(item.scheduleDate)} {getWeekDay(item.scheduleDate)}
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
              确认生产
            </Button>
          )}
          {canWrite && item.status === "进行中" && plan && (
            <Button variant="outline" size="sm" onClick={() => onGotoPlan(plan.id)}>
              查看生产计划
            </Button>
          )}
          {canWrite && item.status === "进行中" && !plan && (
            <Button variant="outline" size="sm" disabled>
              等待排产
            </Button>
          )}
          {canWrite && item.status === "已完成" && (
            <Button variant="outline" size="sm" onClick={onOpen}>
              查看详情
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
