import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";
import { resolveSelfProductionItems } from "@/lib/server/self-production-order-utils";

/** 确认生产：待生效 → 进行中（激活前重跑净料/封装规格校验）。 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);

  try {
    const { existing, updated } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM self_production_orders WHERE id = ${orderId} FOR UPDATE`
      );
      const row = await tx.selfProductionOrder.findUnique({
        where: { id: orderId },
        select: {
          status: true,
          title: true,
          items: { select: { sourceId: true, portions: true } },
        },
      });
      if (!row) throw new Error("内部生产单不存在");
      if (row.status !== "待生效") {
        throw new Error("只有待生效的内部生产单可以确认");
      }

      await resolveSelfProductionItems(
        tx,
        row.items.map((item) => ({ sourceId: item.sourceId, portions: Number(item.portions) }))
      );

      const result = await tx.selfProductionOrder.update({
        where: { id: orderId },
        data: { status: "进行中" },
      });
      return { existing: row, updated: result };
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "SelfProductionOrder",
      entityId: orderId,
      description: `确认内部生产: ${existing.title}`,
    });

    return success(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "内部生产单不存在" ? 404 : message.startsWith("只有") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
