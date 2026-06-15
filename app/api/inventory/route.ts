import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  // 只查询有库存的记录（currentQty > 0）
  const where: Prisma.InventoryWhereInput = { currentQty: { gt: 0 } };

  const rows = await prisma.inventory.findMany({
    where,
    include: {
      ingredient: {
        select: {
          id: true,
          name: true,
          code: true,
          l2Code: true,
          unit: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // 获取二级分类名称
  const l2Codes = rows.map((r) => r.ingredient.l2Code).filter(Boolean);
  const l2Categories = await prisma.ingredientCategoryL2.findMany({
    where: { code: { in: l2Codes } },
    select: { code: true, name: true, parentCode: true },
  });

  // 获取一级分类名称
  const l1Codes = l2Categories.map((c) => c.parentCode).filter(Boolean);
  const l1Categories = await prisma.ingredientCategoryL1.findMany({
    where: { code: { in: l1Codes } },
    select: { code: true, name: true },
  });

  // 计算采购频次（该原料关联的采购单数量）
  const ingredientIds = rows.map((r) => r.ingredientId);
  const purchaseCounts = await prisma.purchaseReceiptItem.groupBy({
    by: ["ingredientId"],
    where: { ingredientId: { in: ingredientIds } },
    _count: { ingredientId: true },
  });
  const countMap = new Map(purchaseCounts.map((p) => [p.ingredientId, p._count.ingredientId]));

  const enriched = rows.map((row) => {
    const l2 = l2Categories.find((c) => c.code === row.ingredient.l2Code);
    const l1 = l2 ? l1Categories.find((c) => c.code === l2.parentCode) : null;
    return {
      ...row,
      ingredient: {
        ...row.ingredient,
        l2Name: l2?.name,
        l1Name: l1?.name,
      },
      purchaseCount: countMap.get(row.ingredientId) || 0,
    };
  });

  // 如果有关键词搜索，过滤
  let result = enriched;
  if (q) {
    const s = q.toLowerCase();
    result = enriched.filter(
      (r) =>
        r.ingredient.name.toLowerCase().includes(s) ||
        r.ingredient.code.toLowerCase().includes(s) ||
        r.ingredient.l2Name?.toLowerCase().includes(s) ||
        r.ingredient.l1Name?.toLowerCase().includes(s)
    );
  }

  return NextResponse.json(result);
}
