"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScheduleStatusTag } from "@/app/components/ui/schedule-status-tag";
import type { ProductionPlanSourceSnapshot } from "@/lib/shared/production-plan";

interface SelfOrderState {
  id: number;
  status: string;
}

interface ProductionPlanSelfProductionProps {
  snapshot: ProductionPlanSourceSnapshot;
  selfOrders: SelfOrderState[];
}

/** 生产计划「内部生产」页签：展示生成时快照 + 来源单据的实时状态。 */
export function ProductionPlanSelfProduction({
  snapshot,
  selfOrders,
}: ProductionPlanSelfProductionProps) {
  const router = useRouter();
  const statusByOrderId = new Map(selfOrders.map((order) => [order.id, order.status]));
  const selfProduction = snapshot.version === 2 ? snapshot.selfProduction : [];

  if (selfProduction.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        本生产计划单没有来源内部生产数据
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selfProduction.map((order) => {
        const totalPortions =
          Math.round(order.items.reduce((sum, item) => sum + item.portions, 0) * 100) / 100;
        return (
          <section key={order.orderId} className="overflow-hidden rounded-lg border">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/40 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">{order.title}</h4>
                  <span className="font-mono text-xs text-muted-foreground">
                    {order.code ?? `内部生产单 #${order.orderId}`}
                  </span>
                  <ScheduleStatusTag
                    status={statusByOrderId.get(order.orderId) ?? null}
                  />
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
                  <span>{new Date(order.produceDate).toLocaleDateString("zh-CN")}</span>
                  <span>{order.items.length} 种净料</span>
                  <span>{totalPortions} 份</span>
                  {order.remark && <span>备注：{order.remark}</span>}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/self-production-orders/${order.orderId}`)}
              >
                <ExternalLink className="mr-1 h-4 w-4" />
                查看内部生产单
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">序号</TableHead>
                    <TableHead>编号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead className="text-right">封装规格</TableHead>
                    <TableHead className="text-right">份数</TableHead>
                    <TableHead className="text-right">切配量（g）</TableHead>
                    <TableHead className="text-right">毛料需求（斤）</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item, index) => (
                    <TableRow key={`${item.sourceType}-${item.sourceId}`} className="hover:bg-muted/40">
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{item.itemCode}</TableCell>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.packageSpec}g
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{item.portions}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.requiredQty}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.grossNeedJin}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={4} className="text-right font-medium">
                      合计
                    </TableCell>
                    <TableCell className="text-right font-bold">{totalPortions}</TableCell>
                    <TableCell className="text-right font-bold">
                      {Math.round(
                        order.items.reduce((sum, item) => sum + item.requiredQty, 0) * 100
                      ) / 100}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {Math.round(
                        order.items.reduce((sum, item) => sum + item.grossNeedJin, 0) * 100
                      ) / 100}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileStack className="h-3.5 w-3.5" />
        明细为生产计划生成时快照，来源内部生产单状态为当前实时状态。
      </p>
    </div>
  );
}
