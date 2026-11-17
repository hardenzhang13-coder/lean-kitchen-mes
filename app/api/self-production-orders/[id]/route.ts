import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";
import { updateSelfProductionOrderSchema } from "@/lib/server/schemas/self-production-order";
import { validateBody } from "@/lib/server/validate";
import {
  buildSelfProductionDetailItems,
  resolveSelfProductionItems,
} from "@/lib/server/self-production-order-utils";
import { nextSelfProductionOrderCode } from "@/lib/server/production-plan-assignment";
import { resolveUsernameToName } from "@/lib/server/user-resolve";
import { buildSelfProductionOrderTitle } from "@/lib/shared/self-production-title";
import { logger } from "@/lib/server/logger";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);

  try {
    const order = await prisma.selfProductionOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { orderBy: { id: "asc" } },
        productionPlanRefs: {
          where: { plan: { deletedAt: null } },
          orderBy: { id: "desc" },
          take: 1,
          select: {
            plan: {
              select: { id: true, code: true, title: true, planDate: true, status: true },
            },
          },
        },
      },
    });
    if (!order) return NextResponse.json({ error: "内部生产单不存在" }, { status: 404 });

    const operatorName = await resolveUsernameToName(order.operator);
    const items = await buildSelfProductionDetailItems(prisma, order.items);

    return success({
      id: order.id,
      code: order.code,
      title: order.title,
      produceDate: order.produceDate.toISOString(),
      status: order.status,
      operator: order.operator,
      operatorName,
      remark: order.remark,
      createdAt: order.createdAt.toISOString(),
      items,
      productionPlan: order.productionPlanRefs[0]?.plan ?? null,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/self-production-orders/[id] failed");
    return NextResponse.json({ error: "获取内部生产单失败" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  const body = await req.json();
  const validation = validateBody(updateSelfProductionOrderSchema, body);
  if (!validation.success) return validation.response;
  const { produceDate, items, remark } = validation.data;

  const produceDateObj = new Date(produceDate);
  const generatedTitle = buildSelfProductionOrderTitle(produceDate);

  let updated: Awaited<ReturnType<typeof prisma.selfProductionOrder.update>> | null = null;
  for (let attempt = 0; attempt < 5 && !updated; attempt++) {
    try {
      updated = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM self_production_orders WHERE id = ${orderId} FOR UPDATE`
        );
        const existing = await tx.selfProductionOrder.findUnique({
          where: { id: orderId },
          select: { status: true, code: true, produceDate: true },
        });
        if (!existing) throw new Error("内部生产单不存在");
        if (existing.status !== "待生效") {
          throw new Error("只有待生效的内部生产单可以修改");
        }

        const resolved = await resolveSelfProductionItems(tx, items);
        const dateText = existing.produceDate.toISOString().slice(0, 10);
        const code =
          existing.code && dateText === produceDate
            ? existing.code
            : await nextSelfProductionOrderCode(tx, produceDateObj);

        await tx.selfProductionItem.deleteMany({ where: { orderId } });
        await tx.selfProductionItem.createMany({
          data: resolved.map((item) => ({
            orderId,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            portions: item.portions,
          })),
        });

        return await tx.selfProductionOrder.update({
          where: { id: orderId },
          data: {
            code,
            title: generatedTitle,
            produceDate: produceDateObj,
            remark: remark?.trim() || null,
          },
        });
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002" && attempt < 4) continue;
      const message = err instanceof Error ? err.message : String(err);
      const status = message === "内部生产单不存在" ? 404 : message.startsWith("只有") ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (!updated) return NextResponse.json({ error: "修改内部生产单失败" }, { status: 500 });

  await logOperation(req, {
    action: "UPDATE",
    entity: "SelfProductionOrder",
    entityId: orderId,
    description: `修改内部生产单: ${updated.title}`,
  });
  return success(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);

  try {
    const existing = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM self_production_orders WHERE id = ${orderId} FOR UPDATE`
      );
      const row = await tx.selfProductionOrder.findUnique({
        where: { id: orderId },
        select: { status: true, title: true },
      });
      if (!row) throw new Error("内部生产单不存在");
      if (row.status !== "待生效") {
        throw new Error("只有待生效的内部生产单可以删除");
      }
      const reference = await tx.productionPlanSelfOrder.findFirst({
        where: { selfOrderId: orderId, plan: { deletedAt: null } },
        select: { id: true },
      });
      if (reference) {
        throw new Error("该内部生产单已纳入生产计划单，不能删除");
      }
      await tx.selfProductionOrder.delete({ where: { id: orderId } });
      return row;
    });

    await logOperation(req, {
      action: "DELETE",
      entity: "SelfProductionOrder",
      entityId: orderId,
      description: "删除内部生产单: " + existing.title,
    });
    return success({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "删除失败";
    if (message === "内部生产单不存在") return NextResponse.json({ error: message }, { status: 404 });
    if (message.startsWith("只有") || message.startsWith("该自主")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    logger.error({ err }, "DELETE /api/self-production-orders/[id] failed");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
