import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { error, success } from "@/lib/server/api-response";
import { logger } from "@/lib/server/logger";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = Number(id);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM production_plans WHERE id = ${planId} AND deleted_at IS NULL FOR UPDATE`
      );
      const existing = await tx.productionPlan.findFirst({
        where: { id: planId, deletedAt: null },
        select: { status: true },
      });
      if (!existing) throw new Error("生产计划单不存在");
      if (existing.status !== "待生效") {
        throw new Error("只有待生效的生产计划单可以确认");
      }
      await tx.productionPlan.update({ where: { id: planId }, data: { status: "进行中" } });
    });
    await logOperation(req, {
      action: "UPDATE",
      entity: "ProductionPlan",
      entityId: planId,
      description: "确认生产计划单",
    });
    return success({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "操作失败";
    if (message === "生产计划单不存在") return error(message, 404, "NOT_FOUND");
    if (message.startsWith("只有")) return error(message, 409, "CONFLICT");
    logger.error({ err }, "PUT activate failed");
    return error("操作失败", 500, "INTERNAL_ERROR");
  }
}
