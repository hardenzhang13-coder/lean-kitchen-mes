import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { paginated } from "@/lib/server/api-response";
import { validateQuery } from "@/lib/server/validate";
import { preppedLedgerQuerySchema } from "@/lib/server/schemas/prepped-stock";
import { round2 } from "@/lib/shared/prepped-stock";

const TYPE_LABEL: Record<string, string> = {
  stock_in: "入库",
  stock_out: "出库",
  stock_rollback: "作废回滚",
};

/** 净菜出入库流水（双单位台账） */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const validation = validateQuery(preppedLedgerQuerySchema, searchParams);
  if (!validation.success) return validation.response;
  const { type, page, pageSize } = validation.data;

  const where = type ? { changeType: type } : {};
  const [rows, total] = await Promise.all([
    prisma.preppedStockLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.preppedStockLedger.count({ where }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    t: r.createdAt.toISOString(),
    type: r.changeType,
    typeLabel: TYPE_LABEL[r.changeType] ?? r.changeType,
    code: r.itemCode,
    name: r.itemName,
    l1Name: r.l1Name ?? "—",
    l2Name: r.l2Name ?? "—",
    changePortions: round2(Number(r.changePortions)),
    changeQty: round2(Number(r.changeQty)),
    balancePortions: round2(Number(r.balancePortions)),
    balanceQty: round2(Number(r.balanceQty)),
    source: r.bizRefCode ?? r.bizType,
    operator: r.operator ?? "—",
  }));

  return paginated(data, { page, pageSize, totalItems: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}