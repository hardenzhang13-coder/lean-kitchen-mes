import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { paginated, created, error, success, internalError } from "@/lib/server/api-response";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { validateBody, validateQuery } from "@/lib/server/validate";
import {
  batchOutboundQuoteSchema,
  createOutboundSchema,
  outboundQuerySchema,
} from "@/lib/server/schemas/prepped-stock";
import { applyStockChanges } from "@/lib/server/prepped-stock";
import {
  getOutboundLines,
  getProductionBatchOutboundLines,
  getSelfOrderOutboundLines,
  limitOutboundLinesToProductionBatch,
  type OutboundLine,
} from "@/lib/server/outbound-utils";
import { round2, calcPortionAmount, CUTTING_CENTER_NAME } from "@/lib/shared/prepped-stock";
import { z } from "zod";
import { logger } from "@/lib/server/logger";

type CreateOutboundItem = {
  sourceType: "net" | "minor";
  sourceId: number;
  shippedPortions: number;
};

function dayPrefix(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `OUT-${y}${m}${dd}-`;
}

async function nextOutboundCode(
  tx: Pick<typeof prisma, "outboundOrder">,
  date: Date
): Promise<string> {
  const prefix = dayPrefix(date);
  const last = await tx.outboundOrder.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const seq = last?.code
    ? parseInt(last.code.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

function prepareOutboundLineData(
  lines: OutboundLine[],
  items: CreateOutboundItem[],
  fixedAsPlanned: boolean
) {
  const itemMap = new Map(items.map((i) => [`${i.sourceType}:${i.sourceId}`, i]));
  let totalPortions = 0;
  let totalAmount = 0;
  let asPlanned = true;

  const lineData = lines.map((l, idx) => {
    const item = itemMap.get(l.key);
    if (!item) throw new Error(`缺少出库行：${l.itemName}（${l.key}）`);
    const shipped = round2(item.shippedPortions);
    if (shipped < 0) throw new Error(`${l.itemName} 出库份数不能为负数`);
    if (shipped > l.availablePortions) {
      throw new Error(`${l.itemName} 出库份数超过可用库存（可用 ${l.availablePortions} 份）`);
    }
    const shippedQty = round2(shipped * l.packageSpec);
    const amount =
      l.standardPackagePrice != null
        ? calcPortionAmount(l.standardPackagePrice, shipped)
        : 0;
    if (!fixedAsPlanned && shipped !== l.requiredPortions) asPlanned = false;
    totalPortions = round2(totalPortions + shipped);
    totalAmount = round2(totalAmount + amount);
    return {
      ...l,
      shippedPortions: shipped,
      shippedQty,
      amount,
      sortIndex: idx + 1,
    };
  });

  if (totalPortions <= 0) {
    throw new Error("本次出库总数必须大于 0");
  }

  return { lineData, totalPortions, totalAmount, asPlanned };
}

const quoteQuerySchema = z.object({
  scheduleId: z.coerce.number().int().positive().optional(),
  selfOrderId: z.coerce.number().int().positive().optional(),
});

/** 出库报价预览：生产批次 / 门店排程；历史内部生产单只保留契约 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const listValidation = validateQuery(outboundQuerySchema, searchParams);
  void listValidation;

  if (searchParams.has("productionPlanId")) {
    const v = validateQuery(batchOutboundQuoteSchema, searchParams);
    if (!v.success) return v.response;
    try {
      const lines = await getProductionBatchOutboundLines(
        prisma,
        v.data.productionPlanId
      );
      return success({ lines });
    } catch (e) {
      logger.error({ err: e }, "GET production batch outbound lines failed");
      return internalError("获取生产批次出库明细失败");
    }
  }

  if (searchParams.has("scheduleId") || searchParams.has("selfOrderId")) {
    const v = validateQuery(quoteQuerySchema, searchParams);
    if (!v.success) return v.response;
    if ((v.data.scheduleId == null) === (v.data.selfOrderId == null)) {
      return error("请选择排程单或内部生产单（二选一）");
    }
    try {
      let lines =
        v.data.scheduleId != null
          ? await getOutboundLines(prisma, v.data.scheduleId)
          : await getSelfOrderOutboundLines(prisma, v.data.selfOrderId as number);
      if (v.data.scheduleId != null) {
        const planReference = await prisma.productionPlanSchedule.findFirst({
          where: { scheduleId: v.data.scheduleId },
          orderBy: { id: "desc" },
          select: { planId: true, plan: { select: { deletedAt: true } } },
        });
        if (planReference && planReference.plan.deletedAt == null) {
          lines = await limitOutboundLinesToProductionBatch(
            prisma,
            planReference.planId,
            lines
          );
        }
      }
      return success({ lines });
    } catch (e) {
      logger.error({ err: e }, "GET outbound quote failed");
      return internalError("获取出库明细失败");
    }
  }

  if (!listValidation.success) return listValidation.response;
  const { status, page, pageSize } = listValidation.data;
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([
    prisma.outboundOrder.findMany({
      where,
      include: { store: { select: { name: true } } },
      orderBy: { outboundAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.outboundOrder.count({ where }),
  ]);
  const data = rows.map((o) => ({
    id: o.id,
    code: o.code,
    subjectType: o.subjectType,
    scheduleId: o.scheduleId,
    productionPlanId: o.productionPlanId,
    subjectName: o.store?.name ?? CUTTING_CENTER_NAME,
    sourceCode: o.scheduleCode,
    sourceTitle: o.scheduleTitle,
    sourceDate: o.scheduleDate.toISOString(),
    outboundAt: o.outboundAt.toISOString(),
    totalPortions: round2(Number(o.totalPortions)),
    totalAmount: round2(Number(o.totalAmount)),
    asPlanned: o.asPlanned,
    status: o.status,
    operator: o.operator ?? "—",
    createdAt: o.createdAt.toISOString(),
  }));
  return paginated(data, {
    page,
    pageSize,
    totalItems: total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

/**
 * 创建出库单：按份出库。
 * 生产批次出库：锁批次计划 + 收货门店，按批次余量和总账余量双条件扣减，可拆多店多单。
 * 排程出库：锁排程 + 收货门店，成功后排程完成；仍保持一排程一张有效单。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const validation = validateBody(createOutboundSchema, body);
  if (!validation.success) return validation.response;
  const {
    scheduleId,
    productionPlanId,
    storeId,
    remark,
    outboundAt,
    items,
  } = validation.data;
  const outboundTime = outboundAt ?? new Date();
  const batchMode = productionPlanId != null;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  try {
    const sourceCount = [scheduleId, productionPlanId].filter(
      (source) => source != null
    ).length;
    if (sourceCount !== 1) {
      return error("排程单出库与生产批次出库二选一");
    }

    const result = await prisma.$transaction(async (tx) => {
      // 先锁收货门店，避免出库过程中门店被停用或删除。
      await tx.$queryRaw`
        SELECT id
        FROM stores
        WHERE id = ${storeId}
        FOR UPDATE
      `;
      const store = await tx.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, isActive: true, deletedAt: true },
      });
      if (!store || store.deletedAt != null) throw new Error("门店不存在或已删除");
      if (!store.isActive) throw new Error("门店已停用，不能出库");

      let lines: OutboundLine[];
      let source: {
        scheduleId: number | null;
        productionPlanId: number | null;
        scheduleCode: string | null;
        scheduleTitle: string;
        scheduleDate: Date;
      };
      let sourceScheduleId: number | null = null;

      if (batchMode) {
        const planId = productionPlanId as number;
        await tx.$queryRaw`
          SELECT id
          FROM production_plans
          WHERE id = ${planId} AND deleted_at IS NULL
          FOR UPDATE
        `;
        const plan = await tx.productionPlan.findFirst({
          where: { id: planId, deletedAt: null },
          select: {
            id: true,
            code: true,
            title: true,
            planDate: true,
            status: true,
          },
        });
        if (!plan) throw new Error("生产批次不存在或已删除");
        if (plan.status !== "已完成") {
          throw new Error("只有已完成的切配计划单可以按批次出库");
        }

        lines = await getProductionBatchOutboundLines(tx, plan.id);
        source = {
          scheduleId: null,
          productionPlanId: plan.id,
          scheduleCode: plan.code,
          scheduleTitle: plan.title,
          scheduleDate: plan.planDate,
        };
      } else {
        const numericScheduleId = scheduleId as number;
        await tx.$queryRaw`
          SELECT id
          FROM schedules
          WHERE id = ${numericScheduleId}
          FOR UPDATE
        `;
        const schedule = await tx.schedule.findUnique({
          where: { id: numericScheduleId },
          select: {
            id: true,
            code: true,
            title: true,
            scheduleDate: true,
            status: true,
            storeId: true,
          },
        });
        if (!schedule) throw new Error("排程不存在");
        if (schedule.status !== "进行中") {
          throw new Error("只有进行中的排程可以出库");
        }
        if (schedule.storeId !== storeId) {
          throw new Error("收货门店与排程单门店不一致");
        }

        const activeOutbound = await tx.outboundOrder.findFirst({
          where: { scheduleId, status: "confirmed" },
          select: { id: true, code: true },
        });
        if (activeOutbound) {
          throw new Error(
            `该排程已有有效出库单 ${activeOutbound.code ?? `#${activeOutbound.id}`}，不能重复出库`
          );
        }

        lines = await getOutboundLines(tx, schedule.id);
        const planReference = await tx.productionPlanSchedule.findFirst({
          where: { scheduleId: schedule.id },
          orderBy: { id: "desc" },
          select: { planId: true, plan: { select: { deletedAt: true } } },
        });
        const scheduleBatchPlanId =
          planReference && planReference.plan.deletedAt == null
            ? planReference.planId
            : null;
        if (scheduleBatchPlanId != null) {
          lines = await limitOutboundLinesToProductionBatch(
            tx,
            scheduleBatchPlanId,
            lines
          );
        }
        sourceScheduleId = schedule.id;
        source = {
          scheduleId: schedule.id,
          productionPlanId: scheduleBatchPlanId,
          scheduleCode: schedule.code,
          scheduleTitle: schedule.title,
          scheduleDate: schedule.scheduleDate,
        };
      }

      const { lineData, totalPortions, totalAmount, asPlanned } =
        prepareOutboundLineData(lines, items, batchMode);

      // 批次单号日期仍使用业务出库时间；同日跨批次连续编号。
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = await nextOutboundCode(tx, outboundTime);
        try {
          const order = await tx.outboundOrder.create({
            data: {
              code,
              subjectType: "store",
              scheduleId: source.scheduleId,
              selfOrderId: null,
              productionPlanId: source.productionPlanId,
              storeId: store.id,
              scheduleCode: source.scheduleCode,
              scheduleTitle: source.scheduleTitle,
              scheduleDate: source.scheduleDate,
              outboundAt: outboundTime,
              totalPortions,
              totalAmount,
              asPlanned,
              status: "confirmed",
              operator,
              remark: remark?.trim() || null,
              items: {
                create: lineData.map((l) => ({
                  sourceType: l.sourceType,
                  sourceId: l.sourceId,
                  itemCode: l.itemCode,
                  itemName: l.itemName,
                  l1Name: l.l1Name,
                  l2Name: l.l2Name,
                  packageSpec: l.packageSpec,
                  requiredPortions: l.requiredPortions,
                  requiredQty: l.requiredQty,
                  availablePortions: l.availablePortions,
                  shippedPortions: l.shippedPortions,
                  shippedQty: l.shippedQty,
                  pricePerJin: l.pricePerJin,
                  amount: l.amount,
                  prepStatus: l.prepStatus,
                  sortIndex: l.sortIndex,
                })),
              },
            },
          });

          await applyStockChanges(
            {
              tx,
              changeType: "stock_out",
              bizType: "outbound",
              bizId: order.id,
              bizRefCode: code,
              scheduleId: source.scheduleId,
              storeId: store.id,
              productionPlanId: source.productionPlanId,
              operator,
            },
            lineData
              .filter((l) => l.shippedPortions > 0)
              .map((l) => ({
                sourceType: l.sourceType,
                sourceId: l.sourceId,
                itemCode: l.itemCode,
                itemName: l.itemName,
                l1Name: l.l1Name,
                l2Name: l.l2Name,
                portions: l.shippedPortions,
                qtyG: l.shippedQty,
              }))
          );

          if (batchMode && source.productionPlanId != null) {
            // 批次全部发完后，来源门店排程进入已完成；拆店中途仍保持进行中。
            const remainingBatchRows = await tx.preppedStockBatch.count({
              where: {
                productionPlanId: source.productionPlanId,
                currentPortions: { gt: 0 },
              },
            });
            if (remainingBatchRows === 0) {
              const planSchedules = await tx.productionPlanSchedule.findMany({
                where: { planId: source.productionPlanId },
                select: { scheduleId: true },
              });
              await tx.schedule.updateMany({
                where: {
                  id: { in: planSchedules.map((s) => s.scheduleId) },
                  status: "进行中",
                },
                data: { status: "已完成" },
              });
            }
          } else if (sourceScheduleId != null) {
            await tx.schedule.update({
              where: { id: sourceScheduleId },
              data: { status: "已完成" },
            });
          }

          return {
            id: order.id,
            code,
            totalPortions,
            totalAmount,
            asPlanned,
          };
        } catch (e) {
          lastError = e;
          if (
            e instanceof Error &&
            "code" in e &&
            (e as { code?: string }).code === "P2002"
          ) {
            continue;
          }
          throw e;
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error("出库单号生成冲突，请重试");
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "OutboundOrder",
      entityId: result.id,
      description: `创建${batchMode ? "生产批次" : ""}出库单: ${result.code}（${result.totalPortions} 份 / ¥${result.totalAmount}）`,
    });

    return created(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn({ err: e }, "POST outbound-order failed");
    return error(message);
  }
}
