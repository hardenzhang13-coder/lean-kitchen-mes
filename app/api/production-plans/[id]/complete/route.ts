import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { success, error } from "@/lib/server/api-response";
import { validateBody } from "@/lib/server/validate";
import { completeProductionPlanSchema } from "@/lib/server/schemas/prepped-stock";
import { applyStockChanges } from "@/lib/server/prepped-stock";
import { round2, rowConfirmStatus, type PlanCuttingRow } from "@/lib/shared/prepped-stock";
import { logger } from "@/lib/server/logger";
import { syncSourceScheduleStatuses } from "@/lib/server/production-plan-assignment";

/**
 * 完成生产（生产计划单）：逐行确认切配（完成/未完成/暂不确认）→ 净菜自动入库（份+g 双单位）
 * → 回写各店 cutting_orders → 计划单终态判定。全事务，行级幂等（已终态行跳过）。
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = Number(id);
  const body = await req.json().catch(() => null);
  const validation = validateBody(completeProductionPlanSchema, body);
  if (!validation.success) return validation.response;
  const { items } = validation.data;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`
          SELECT id
          FROM production_plans
          WHERE id = ${planId} AND deleted_at IS NULL
          FOR UPDATE
        `
      );
      const plan = await tx.productionPlan.findFirst({
        where: { id: planId, deletedAt: null },
        select: { id: true, code: true, status: true, cuttingJson: true, schedules: { select: { scheduleId: true } } },
      });
      if (!plan) throw new Error("生产计划单不存在");
      if (plan.status !== "进行中") throw new Error("只有进行中的生产计划单可以完成生产");

      const rows = (Array.isArray(plan.cuttingJson) ? plan.cuttingJson : []) as unknown as PlanCuttingRow[];
      const rowMap = new Map(rows.map((r) => [`${r.sourceType}:${r.sourceId}`, r]));

      // 1) 行级确认（hold 保持 pending；已终态行幂等跳过）
      const stockInItems: { row: PlanCuttingRow; portions: number }[] = [];
      const unfinishedKeys: string[] = [];
      let confirmedCount = 0;
      for (const item of items) {
        const row = rowMap.get(item.sourceKey);
        if (!row) throw new Error(`切配行不存在：${item.sourceKey}`);
        if (rowConfirmStatus(row) !== "pending") continue; // 幂等：已确认行忽略
        if (item.status === "hold") continue;
        if (item.status === "completed") {
          const ap = round2(item.actualPortions ?? 0);
          if (ap < 0) throw new Error(`${row.itemName} 实际完成份数不能为负数`);
          row.confirmStatus = "completed";
          row.actualPortions = ap;
          row.remark = null;
          confirmedCount++;
          if (ap > 0) {
            if (!row.packageSpec || row.packageSpec <= 0) {
              throw new Error(`${row.itemName} 缺少封装规格，无法按份入库`);
            }
            stockInItems.push({ row, portions: ap });
          }
        } else {
          row.confirmStatus = "unfinished";
          row.actualPortions = 0;
          row.remark = item.remark?.trim() || null;
          unfinishedKeys.push(item.sourceKey);
          confirmedCount++;
        }
      }
      if (confirmedCount === 0) {
        throw new Error("没有可确认的切配行（可能均已确认，请刷新）");
      }

      // 2) 更新快照确认态
      await tx.productionPlan.update({
        where: { id: planId },
        data: { cuttingJson: rows as object[] },
      });

      // 3) 净菜入库（份 + 按当时封装规格换算 g）
      await applyStockChanges(
        {
          tx,
          changeType: "stock_in",
          bizType: "production_complete",
          bizId: planId,
          bizRefCode: plan.code ?? `PPL-${planId}`,
          scheduleId: null,
          storeId: null,
          operator,
        },
        stockInItems.map(({ row, portions }) => ({
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          itemCode: row.sourceCode,
          itemName: row.itemName,
          l1Name: row.l1Name,
          l2Name: row.l2Name,
          portions,
          qtyG: round2(portions * (row.packageSpec as number)),
        }))
      );

      // 4) 回写各店 cutting_orders（actualQty 按需求量占比分摊，展示级精度）
      const scheduleIds = plan.schedules.map((s) => s.scheduleId);
      const storeOrders = await tx.cuttingOrder.findMany({
        where: { scheduleId: { in: scheduleIds } },
        select: { id: true, scheduleId: true, sourceType: true, sourceId: true, requiredQty: true },
      });
      const mergedByKey = new Map<string, number>();
      for (const r of rows) {
        const key = `${r.sourceType}:${r.sourceId}`;
        mergedByKey.set(key, (mergedByKey.get(key) ?? 0) + Number(r.requiredQty));
      }
      const actualByKey = new Map<string, number>();
      for (const { row, portions } of stockInItems) {
        const key = `${row.sourceType}:${row.sourceId}`;
        actualByKey.set(key, round2(portions * (row.packageSpec as number)));
      }
      for (const order of storeOrders) {
        const key = `${order.sourceType}:${order.sourceId}`;
        const status = rowMap.has(key) ? rowConfirmStatus(rowMap.get(key) as PlanCuttingRow) : "pending";
        if (status === "pending") continue; // 暂不确认行不回写
        const merged = mergedByKey.get(key) ?? 0;
        const actualG = actualByKey.get(key) ?? 0;
        const share = merged > 0 ? round2((actualG * Number(order.requiredQty)) / merged) : 0;
        await tx.cuttingOrder.update({
          where: { id: order.id },
          data: {
            actualQty: status === "completed" ? share : 0,
            status: status === "completed" ? "completed" : "unfinished",
          },
        });
      }

      // 5) 计划单终态：无 pending 行 → 已完成
      const stillPending = rows.some((r) => rowConfirmStatus(r) === "pending");
      const newStatus = stillPending ? "进行中" : "已完成";
      await tx.productionPlan.update({ where: { id: planId }, data: { status: newStatus } });
      const completedScheduleIds = await syncSourceScheduleStatuses(tx, scheduleIds);

      return {
        status: newStatus,
        inPortions: round2(stockInItems.reduce((s, x) => s + x.portions, 0)),
        inKinds: stockInItems.length,
        unfinished: unfinishedKeys.length,
        completedSchedules: completedScheduleIds.length,
      };
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "ProductionPlan",
      entityId: planId,
      description: `完成生产: 入库 ${result.inKinds} 种 / ${result.inPortions} 份，未完成 ${result.unfinished} 种`,
    });

    return success(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn({ err: e }, "PUT production-plan complete failed");
    return error(message);
  }
}
