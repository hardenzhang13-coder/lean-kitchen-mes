import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { success } from "@/lib/server/api-response";
import { buildSelfProductionDetailItems } from "@/lib/server/self-production-order-utils";
import { resolveUsernameToName } from "@/lib/server/user-resolve";
import { logger } from "@/lib/server/logger";

/** 内部生产单页面已下线，此路由仅保留只读详情（历史生产计划单快照展示依赖）。 */
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
