import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const type = searchParams.get("type");

  const where: Prisma.InventoryLedgerWhereInput = {};
  if (startDate || endDate) {
    where.changeTime = {};
    if (startDate) where.changeTime.gte = new Date(startDate);
    if (endDate) where.changeTime.lte = new Date(endDate);
  }
  if (type) where.changeType = type;

  const rows = await prisma.inventoryLedger.findMany({
    where,
    orderBy: { changeTime: "desc" },
    include: {
      ingredient: { select: { id: true, name: true, code: true } },
    },
  });

  // 按 source 分组聚合
  const groupMap = new Map<
    string,
    {
      source: string;
      type: string;
      changeTime: Date;
      operator: string | null;
      settlementStatus: string;
      items: typeof rows;
      receiptId?: number;
    }
  >();

  for (const row of rows) {
    const key = row.source;
    if (!groupMap.has(key)) {
      // 解析是否是采购入库
      const receiptMatch = row.source.match(/^采购入库\/(\d+)$/);
      groupMap.set(key, {
        source: row.source,
        type: row.changeType,
        changeTime: row.changeTime,
        operator: row.operator,
        settlementStatus: row.settlementStatus,
        items: [],
        receiptId: receiptMatch ? Number(receiptMatch[1]) : undefined,
      });
    }
    groupMap.get(key)!.items.push(row);
  }

  // 查询关联的采购单信息
  const receiptIds = Array.from(groupMap.values())
    .filter((g) => g.receiptId)
    .map((g) => g.receiptId!);

  const receipts =
    receiptIds.length > 0
      ? await prisma.purchaseReceipt.findMany({
          where: { id: { in: receiptIds } },
          select: {
            id: true,
            receiptDate: true,
            summary: true,
            totalAmount: true,
            operator: true,
          },
        })
      : [];

  const receiptMap = new Map(receipts.map((r) => [r.id, r]));

  // 构建聚合结果
  const groups = Array.from(groupMap.values()).map((g) => {
    const receipt = g.receiptId ? receiptMap.get(g.receiptId) : null;
    return {
      key: g.source,
      type: g.type,
      source: g.source,
      changeTime: g.changeTime,
      operator: g.operator,
      operatorName: null as string | null,
      settlementStatus: g.settlementStatus,
      itemCount: g.items.length,
      totalQty: g.items.reduce((s, it) => s + Number(it.changeQty), 0),
      // 采购单关联信息
      receiptId: g.receiptId,
      receiptDate: receipt?.receiptDate,
      receiptSummary: receipt?.summary,
      receiptTotalAmount: receipt?.totalAmount,
      receiptOperator: receipt?.operator,
      receiptOperatorName: null as string | null,
      // 明细
      items: g.items.map((it) => ({
        id: it.id,
        ingredientId: it.ingredientId,
        ingredientName: it.ingredient.name,
        ingredientCode: it.ingredient.code,
        changeQty: it.changeQty,
        unit: it.unit,
        balance: it.balance,
      })),
    };
  });

  // 批量解析操作人姓名为展示名称
  const usernames = Array.from(
    new Set(
      groups
        .flatMap((g) => [g.operator, g.receiptOperator])
        .filter((x): x is string => !!x)
    )
  );
  const userNameMap = new Map<string, string>();
  if (usernames.length > 0) {
    const users = await prisma.user.findMany({
      where: { username: { in: usernames } },
      select: { username: true, name: true },
    });
    for (const u of users) {
      userNameMap.set(u.username, u.name || u.username);
    }
  }

  const enriched = groups.map((g) => ({
    ...g,
    operatorName: g.operator ? userNameMap.get(g.operator) || g.operator : null,
    receiptOperatorName: g.receiptOperator
      ? userNameMap.get(g.receiptOperator) || g.receiptOperator
      : null,
  }));

  return NextResponse.json(enriched);
}
