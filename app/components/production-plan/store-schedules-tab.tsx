"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, FileStack, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/app/components/ui/status-badge";
import type { ProductionPlanSourceSnapshot } from "@/lib/shared/production-plan";

interface SourceScheduleState {
  id: number;
  status: string;
}

interface ProductionPlanStoreSchedulesProps {
  snapshot: ProductionPlanSourceSnapshot;
  sourceSchedules: SourceScheduleState[];
}

export function ProductionPlanStoreSchedules({
  snapshot,
  sourceSchedules,
}: ProductionPlanStoreSchedulesProps) {
  const router = useRouter();
  const statusByScheduleId = new Map(
    sourceSchedules.map((schedule) => [schedule.id, schedule.status])
  );

  if (snapshot.stores.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        本生产计划单没有来源排程数据
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {snapshot.stores.map((store) => {
        const dishCount = store.schedules.reduce(
          (sum, schedule) => sum + schedule.items.length,
          0
        );
        const totalQuantity = store.schedules.reduce(
          (sum, schedule) =>
            sum + schedule.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
          0
        );

        return (
          <section key={store.storeId} className="rounded-lg border overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b bg-muted/40 px-4 py-3">
              <h3 className="flex items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4 text-primary" />
                {store.storeName}
              </h3>
              <span className="text-sm text-muted-foreground">
                {store.schedules.length} 张排程单
              </span>
              <span className="text-sm text-muted-foreground">
                {dishCount} 个菜品
              </span>
              <span className="text-sm text-muted-foreground">
                合计 {totalQuantity} 份
              </span>
            </div>

            <div className="space-y-4 p-4">
              {store.schedules.map((schedule) => {
                const scheduleTotal = schedule.items.reduce(
                  (sum, item) => sum + item.quantity,
                  0
                );
                return (
                  <div key={schedule.scheduleId} className="rounded-lg border">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium">{schedule.title}</h4>
                          <span className="font-mono text-xs text-muted-foreground">
                            {schedule.code ?? `排程 #${schedule.scheduleId}`}
                          </span>
                          <StatusBadge
                            status={statusByScheduleId.get(schedule.scheduleId) ?? null}
                          />
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
                          <span>
                            {new Date(schedule.scheduleDate).toLocaleDateString("zh-CN")}
                          </span>
                          <span>{schedule.items.length} 个菜品</span>
                          <span>{scheduleTotal} 份</span>
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/schedules/${schedule.scheduleId}`)}
                      >
                        <ExternalLink className="mr-1 h-4 w-4" />
                        查看排程
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">序号</TableHead>
                            <TableHead>菜品名称</TableHead>
                            <TableHead>份量</TableHead>
                            <TableHead>荤素</TableHead>
                            <TableHead>菜品编号</TableHead>
                            <TableHead className="text-right">数量（份）</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schedule.items.map((item, index) => (
                            <TableRow key={item.id} className="hover:bg-muted/40">
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">{item.dishName}</TableCell>
                              <TableCell>{item.portion}</TableCell>
                              <TableCell>{item.meatType || "—"}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {item.dishCode}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {item.quantity}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/40">
                            <TableCell colSpan={5} className="text-right font-medium">
                              合计
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {scheduleTotal}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileStack className="h-3.5 w-3.5" />
        菜单内容为生产计划生成时快照，来源排程状态为当前实时状态。
      </p>
    </div>
  );
}
