import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { paginated, created, error, success } from "@/lib/server/api-response";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { createOutboundSchema, outboundQuerySchema } from "@/lib/server/schemas/prepped-stock";
import { applyStockChanges } from "@/lib/server/prepped-stock";
import { getOutboundLines, getSelfOrderOutboundLines } from "@/lib/server/outbound-utils";
import { round2, calcLineAmount, CUTTING_CENTER_NAME } from "@/lib/shared/prepped-stock";
import { z } from "zod";
import { logger } from "@/lib/server/logger";

function dayPrefix(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `OUT-${y}${m}${dd}-`;
}

async function nextOutboundCode(tx: Pick<typeof prisma, "outboundOrder">, date: Date): Promise<string> {
  const prefix = dayPrefix(date);
  const last = await tx.outboundOrder.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const seq = last?.code ? parseInt(last.code.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

const quoteQuerySchema = z.object({
  scheduleId: z.coerce.number().int().positive().optional(),
  selfOrderId: z.coerce.number().int().positive().optional(),
});

/** 出库报价预览：门店取切配工单计划行，切配中心取内部生产单明细 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const listValidation = validateQuery(outboundQuerySchema, searchParams);
  void listValidation; // 列表查询走下方逻辑分支（scheduleId / selfOrderId 存在 = 报价）

  if (searchParams.has("scheduleId") || searchParams.has("selfOrderId")) {
    const v = validateQuery(quoteQuerySchema, searchParams);
    if (!v.success) return v.response;
    if ((v.data.scheduleId == null) === (v.data.selfOrderId == null)) {
      return error("请选择排程单或内部生产单（二选一）");
    }
    try {
      const lines =
        v.data.scheduleId != null
          ? await getOutboundLines(prisma, v.data.scheduleId)
          : await getSelfOrderOutboundLines(prisma, v.data.selfOrderId as number);
      return success({ lines });
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e));
    }
  }

  if (!listValidation.success) return listValidation.response;
  const { status, page, pageSize } = listValidation.data;
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([
    prisma.outboundOrder.findMany({
      where,
      include: { store: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.outboundOrder.count({ where }),
  ]);
  const data = rows.map((o) => ({
    id: o.id,
    code: o.code,
    subjectType: o.subjectType,
    subjectName: o.store?.name ?? CUTTING_CENTER_NAME,
    sourceCode: o.scheduleCode,
    sourceTitle: o.scheduleTitle,
    sourceDate: o.scheduleDate.toISOString(),
    totalPortions: round2(Number(o.totalPortions)),
    totalAmount: round2(Number(o.totalAmount)),
    asPlanned: o.asPlanned,
    status: o.status,
    operator: o.operator ?? "—",
    createdAt: o.createdAt.toISOString(),
  }));
  return paginated(data, { page, pageSize, totalItems: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

/**
 * 创建出库单：按份出库。
 * 来源二选一：门店排程单 / 切配中心内部生产单。
 * 事务：快照明细（含出库价/金额）→ 扣库存（条件更新防并发）→ 台账。
 * 是否按计划出库 = 全部明细 shipped_portions == required_portions。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const validation = validateBody(createOutboundSchema, body);
  if (!validation.success) return validation.response;
  const { scheduleId, selfOrderId, remark, items } = validation.data;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  try {
    // 统一来源快照：门店主体取排程单，切配中心主体取内部生产单
    let source: {
      subjectType: "store" | "cutting_center";
      storeId: number | null;
      scheduleId: number | null;
      selfOrderId: number | null;
      code: string | null;
      title: string;
      date: Date;
    };
    if (scheduleId != null) {
      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        select: { id: true, code: true, title: true, scheduleDate: true, status: true, storeId: true },
      });
      if (!schedule) return error("排程不存在");
      if (schedule.status === "待生效") return error("该排程尚未确认生产计划，不能出库");
      source = {
        subjectType: "store",
        storeId: schedule.storeId,
        scheduleId: schedule.id,
        selfOrderId: null,
        code: schedule.code,
        title: schedule.title,
        date: schedule.scheduleDate,
      };
    } else {
      const selfOrder = await prisma.selfProductionOrder.findUnique({
        where: { id: selfOrderId as number },
        select: { id: true, code: true, title: true, produceDate: true, status: true },
      });
      if (!selfOrder) return error("内部生产单不存在");
      if (selfOrder.status === "待生效") return error("该内部生产单尚未确认生产计划，不能出库");
      source = {
        subjectType: "cutting_center",
        storeId: null,
        scheduleId: null,
        selfOrderId: selfOrder.id,
        code: selfOrder.code,
        title: selfOrder.title,
        date: selfOrder.produceDate,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const lines =
        source.scheduleId != null
          ? await getOutboundLines(tx, source.scheduleId)
          : await getSelfOrderOutboundLines(tx, source.selfOrderId as number);
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
          throw new Error(`${l.itemName} 出库份数超过库存（库存 ${l.availablePortions} 份）`);
        }
        const shippedQty = round2(shipped * l.packageSpec);
        const amount = l.pricePerJin != null ? calcLineAmount(l.pricePerJin, shippedQty) : 0;
        if (shipped !== l.requiredPortions) asPlanned = false;
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

      // 生成单号（当日序号，唯一冲突重试 5 次）
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = await nextOutboundCode(tx, new Date());
        try {
          const order = await tx.outboundOrder.create({
            data: {
              code,
              subjectType: source.subjectType,
              scheduleId: source.scheduleId,
              selfOrderId: source.selfOrderId,
              storeId: source.storeId,
              scheduleCode: source.code,
              scheduleTitle: source.title,
              scheduleDate: source.date,
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
              storeId: source.storeId,
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

          return { id: order.id, code, totalPortions, totalAmount, asPlanned };
        } catch (e) {
          lastError = e;
          if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") continue;
          throw e;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("出库单号生成冲突，请重试");
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "OutboundOrder",
      entityId: result.id,
      description: `创建出库单: ${result.code}（${result.totalPortions} 份 / ¥${result.totalAmount}）`,
    });

    return created(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn({ err: e }, "POST outbound-order failed");
    return error(message);
  }
}

