import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { error, success } from "@/lib/server/api-response";
import { logger } from "@/lib/server/logger";
import { rowConfirmStatus, type PlanCuttingRow } from "@/lib/shared/prepped-stock";

/** 作废进行中的切配计划单：回退到待生效，恢复可编辑。已有切配完成记录（净菜入库）时拦截。 */
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
        select: { status: true, cuttingJson: true },
      });
      if (!existing) throw new Error("切配计划单不存在");
      if (existing.status !== "进行中") {
        throw new Error("只有进行中的切配计划单可以作废");
      }
      const rows = (Array.isArray(existing.cuttingJson) ? existing.cuttingJson : []) as unknown as PlanCuttingRow[];
      if (rows.some((row) => rowConfirmStatus(row) !== "pending")) {
        throw new Error("已有切配完成记录（净菜已入库），不能作废");
      }
      await tx.productionPlan.update({ where: { id: planId }, data: { status: "待生效" } });
    });
    await logOperation(req, {
      action: "UPDATE",
      entity: "ProductionPlan",
      entityId: planId,
      description: "作废切配计划单（回退待生效）",
    });
    return success({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "操作失败";
    if (message === "切配计划单不存在") return error(message, 404, "NOT_FOUND");
    if (message.startsWith("只有") || message.startsWith("已有")) {
      return error(message, 409, "CONFLICT");
    }
    logger.error({ err }, "PUT void failed");
    return error("操作失败", 500, "INTERNAL_ERROR");
  }
}
