import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { success, error, notFound } from "@/lib/server/api-response";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { validateBody } from "@/lib/server/validate";
import { voidOutboundSchema } from "@/lib/server/schemas/prepped-stock";
import { applyStockChanges } from "@/lib/server/prepped-stock";
import { logger } from "@/lib/server/logger";

/** 作废出库单：二次确认 + 必填原因；事务内回滚库存（份+g 双单位）并写作废回滚台账。作废 ≠ 删除。 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  const body = await req.json().catch(() => null);
  const validation = validateBody(voidOutboundSchema, body);
  if (!validation.success) return validation.response;
  const { reason } = validation.data;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  try {
    let scheduleRestored = false;
  let batchRestored = false;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM outbound_orders
        WHERE id = ${orderId}
        FOR UPDATE
      `;
      const order = await tx.outboundOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new Error("出库单不存在");
      if (order.status !== "confirmed") throw new Error("该出库单已作废，不能重复作废");

      await tx.outboundOrder.update({
        where: { id: orderId },
        data: { status: "voided", voidedAt: new Date(), voidReason: reason.trim() },
      });

      await applyStockChanges(
        {
          tx,
          changeType: "stock_rollback",
          bizType: "outbound_void",
          bizId: order.id,
          bizRefCode: order.code,
          scheduleId: order.scheduleId,
          storeId: order.storeId,
          productionPlanId: order.productionPlanId,
          operator,
        },
        order.items
          .filter((it) => Number(it.shippedPortions) > 0)
          .map((it) => ({
            sourceType: it.sourceType,
            sourceId: it.sourceId,
            itemCode: it.itemCode,
            itemName: it.itemName,
            l1Name: it.l1Name,
            l2Name: it.l2Name,
            portions: Number(it.shippedPortions),
            qtyG: Number(it.shippedQty),
          }))
      );

      // 最后一张有效出库单作废后，排程重新回到可出库状态
      if (order.scheduleId != null) {
        await tx.$queryRaw`
          SELECT id
          FROM schedules
          WHERE id = ${order.scheduleId}
          FOR UPDATE
        `;
        const otherActiveCount = await tx.outboundOrder.count({
          where: {
            scheduleId: order.scheduleId,
            status: "confirmed",
            id: { not: orderId },
          },
        });
        if (otherActiveCount === 0) {
          await tx.schedule.updateMany({
            where: { id: order.scheduleId, status: "已完成" },
            data: { status: "进行中" },
          });
          scheduleRestored = true;
        }
      } else if (order.productionPlanId != null) {
        // 批次余量回滚后，来源排程恢复为可继续拆店出库。
        const remainingBatchRows = await tx.preppedStockBatch.count({
          where: {
            productionPlanId: order.productionPlanId,
            currentPortions: { gt: 0 },
          },
        });
        if (remainingBatchRows > 0) {
          await tx.$queryRaw`
            SELECT id
            FROM production_plans
            WHERE id = ${order.productionPlanId}
            FOR UPDATE
          `;
          const planSchedules = await tx.productionPlanSchedule.findMany({
            where: { planId: order.productionPlanId },
            select: { scheduleId: true },
          });
          await tx.schedule.updateMany({
            where: {
              id: { in: planSchedules.map((s) => s.scheduleId) },
              status: "已完成",
            },
            data: { status: "进行中" },
          });
          batchRestored = true;
        }
      }
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "OutboundOrder",
      entityId: orderId,
      description: `作废出库单 #${orderId}：${reason.trim()}${scheduleRestored ? "；来源排程已恢复可出库" : batchRestored ? "；生产批次来源排程已恢复可出库" : ""}`,
    });

    return success({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === "出库单不存在") return notFound(message);
    logger.warn({ err: e }, "POST outbound-void failed");
    return error(message);
  }
}
