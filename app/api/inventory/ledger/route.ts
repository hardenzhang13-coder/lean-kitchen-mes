import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paginated, internalError } from "@/lib/api-response";
import { paginationQuerySchema } from "@/lib/schemas/common";
import { validateQuery } from "@/lib/validate";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { page, pageSize } = validation.data;
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
        ingredient: { select: { id: true, name: true, code: true, l2Code: true } },
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
      const unifiedItems = g.items
        .map((it) => {
          if (!it.ingredient) return null;
          return {
            id: it.id,
            sourceId: it.ingredient.id,
            name: it.ingredient.name,
            code: it.ingredient.code,
            l2Code: it.ingredient.l2Code,
            changeQty: Number(it.changeQty),
            unit: it.unit,
            balance: Number(it.balance),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        key: g.source,
        type: g.type,
        source: g.source,
        changeTime: g.changeTime,
        operator: g.operator,
        operatorName: null as string | null,
        settlementStatus: g.settlementStatus,
        itemCount: unifiedItems.length,
        totalQty: unifiedItems.reduce((s, it) => s + it.changeQty, 0),
        // 采购单关联信息
        receiptId: g.receiptId,
        receiptDate: receipt?.receiptDate,
        receiptSummary: receipt?.summary,
        receiptTotalAmount: receipt?.totalAmount,
        receiptOperator: receipt?.operator,
        receiptOperatorName: null as string | null,
        // 明细
        items: unifiedItems,
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

    const totalItems = enriched.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;
    const paginatedItems = enriched.slice(skip, skip + pageSize);

    return paginated(paginatedItems, { page: safePage, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取库存台账失败");
  }
}
