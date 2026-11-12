import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { error, success } from "@/lib/server/api-response";
import { resolveUsernameToName } from "@/lib/server/user-resolve";
import { logger } from "@/lib/server/logger";
import { updateProductionPlanSchema } from "@/lib/server/schemas/production-plan";
import { validateBody } from "@/lib/server/validate";
import {
  buildProductionPlanData,
  buildSourceScheduleSnapshot,
  type ProductionPlanSourceSnapshot,
} from "@/lib/server/production-plan-utils";
import {
  lockProductionPlan,
  lockSchedulesForProductionPlan,
  nextProductionPlanCode,
  ProductionPlanAssignmentError,
} from "@/lib/server/production-plan-assignment";

function normalizeSourceSnapshot(value: unknown): ProductionPlanSourceSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as { version?: unknown; stores?: unknown };
  if (snapshot.version !== 1 || !Array.isArray(snapshot.stores)) return null;
  return value as ProductionPlanSourceSnapshot;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = Number(id);

  const plan = await prisma.productionPlan.findFirst({
    where: { id: planId, deletedAt: null },
    include: {
      schedules: {
        include: {
          schedule: {
            select: {
              id: true,
              code: true,
              title: true,
              scheduleDate: true,
              status: true,
              store: { select: { id: true, name: true } },
              items: {
                orderBy: { id: "asc" },
                select: {
                  id: true,
                  quantity: true,
                  dish: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      portion: true,
                      meatType: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!plan) return NextResponse.json({ error: "生产计划单不存在" }, { status: 404 });

  const operatorName = await resolveUsernameToName(plan.operator);
  const sourceSnapshot =
    normalizeSourceSnapshot(plan.sourceScheduleJson) ??
    buildSourceScheduleSnapshot(plan.schedules.map((reference) => reference.schedule));
  const sourceSchedules = [...plan.schedules]
    .sort(
      (a, b) =>
        a.schedule.scheduleDate.getTime() - b.schedule.scheduleDate.getTime() ||
        (a.schedule.code ?? "").localeCompare(b.schedule.code ?? "", "zh")
    )
    .map((s) => ({
      id: s.schedule.id,
      code: s.schedule.code,
      title: s.schedule.title,
      scheduleDate: s.schedule.scheduleDate.toISOString(),
      status: s.schedule.status,
      totalQuantity: s.schedule.items.reduce((sum, item) => sum + item.quantity, 0),
      store: s.schedule.store,
    }));
  return success({
    id: plan.id,
    code: plan.code,
    title: plan.title,
    planDate: plan.planDate.toISOString(),
    status: plan.status,
    operator: plan.operator,
    operatorName,
    createdAt: plan.createdAt.toISOString(),
    cuttingOrders: (Array.isArray(plan.cuttingJson) ? plan.cuttingJson : []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...row,
        confirmStatus: row.confirmStatus ?? "pending",
        actualPortions: row.actualPortions ?? null,
        remark: row.remark ?? null,
      };
    }),

    purchasePlans: plan.purchaseJson ?? [],
    sourceSchedules,
    sourceSnapshot,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = Number(id);
  const body = await req.json();
  const validation = validateBody(updateProductionPlanSchema, body);
  if (!validation.success) return validation.response;

  const { title, planDate, scheduleIds } = validation.data;
  const uniqueIds = [...new Set(scheduleIds)];
  const planDateObj = new Date(planDate);

  let updated: Awaited<ReturnType<typeof prisma.productionPlan.update>> | null = null;
  for (let attempt = 0; attempt < 5 && !updated; attempt++) {
    try {
      updated = await prisma.$transaction(async (tx) => {
        if (!(await lockProductionPlan(tx, planId))) {
          throw new Error("生产计划单不存在");
        }
        const existing = await tx.productionPlan.findFirst({
          where: { id: planId, deletedAt: null },
          select: { code: true, status: true, planDate: true },
        });
        if (!existing) throw new Error("生产计划单不存在");
        if (existing.status !== "待生效") {
          throw new ProductionPlanAssignmentError("只有待生效的生产计划单可以修改", 409);
        }

        await lockSchedulesForProductionPlan(tx, uniqueIds, planId);
        const planDateText = existing.planDate.toISOString().slice(0, 10);
        const code =
          existing.code && planDateText === planDate
            ? existing.code
            : await nextProductionPlanCode(tx, planDateObj);
        const data = await buildProductionPlanData(tx, uniqueIds);

        await tx.productionPlanSchedule.deleteMany({ where: { planId } });
        await tx.productionPlanSchedule.createMany({
          data: uniqueIds.map((scheduleId) => ({ planId, scheduleId })),
        });
        return await tx.productionPlan.update({
          where: { id: planId },
          data: {
            code,
            title: title.trim(),
            planDate: planDateObj,
            cuttingJson: JSON.parse(JSON.stringify(data.cutting)),
            purchaseJson: JSON.parse(JSON.stringify(data.purchase)),
            sourceScheduleJson: JSON.parse(JSON.stringify(data.sourceSnapshot)),
          },
        });
      });
    } catch (err) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code?: string }).code === "P2002" &&
        attempt < 4
      ) {
        continue;
      }
      if (err instanceof ProductionPlanAssignmentError) {
        return error(err.message, err.status, err.status === 409 ? "CONFLICT" : "BAD_REQUEST");
      }
      const message = err instanceof Error ? err.message : String(err);
      return error(message, message === "生产计划单不存在" ? 404 : 400);
    }
  }

  if (!updated) return error("修改生产计划单失败", 500, "INTERNAL_ERROR");

  await logOperation(req, {
    action: "UPDATE",
    entity: "ProductionPlan",
    entityId: planId,
    description: `修改生产计划单: ${updated.title}（汇总 ${uniqueIds.length} 张排程单）`,
  });
  return success(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = Number(id);
  try {
    const existing = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM production_plans WHERE id = ${planId} FOR UPDATE`
      );
      const row = await tx.productionPlan.findFirst({
        where: { id: planId, deletedAt: null },
        select: { status: true, title: true },
      });
      if (!row) throw new Error("生产计划单不存在");
      if (row.status !== "待生效") {
        throw new Error("只有待生效的生产计划单可以删除");
      }
      await tx.productionPlan.update({ where: { id: planId }, data: { deletedAt: new Date() } });
      return row;
    });
    await logOperation(req, {
      action: "DELETE",
      entity: "ProductionPlan",
      entityId: planId,
      description: "删除生产计划单: " + existing.title,
    });
    return success({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "删除失败";
    if (message === "生产计划单不存在") return error(message, 404, "NOT_FOUND");
    if (message.startsWith("只有")) return error(message, 409, "CONFLICT");
    logger.error({ err }, "DELETE /api/production-plans/[id] failed");
    return error("删除失败", 500, "INTERNAL_ERROR");
  }
}
