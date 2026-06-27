import { NextRequest } from "next/server";
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
    const q = searchParams.get("q");

    const rows = await prisma.inventory.findMany({
      where: { currentQty: { gt: 0 } },
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            code: true,
            l2Code: true,
            stockUnit: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const l2Codes = rows
      .map((r) => r.ingredient?.l2Code)
      .filter((code): code is string => !!code);

    const l2Categories = await prisma.ingredientCategoryL2.findMany({
      where: { code: { in: l2Codes } },
      select: { code: true, name: true, parentCode: true },
    });

    const l1Codes = l2Categories.map((c) => c.parentCode).filter(Boolean);
    const l1Categories = await prisma.ingredientCategoryL1.findMany({
      where: { code: { in: l1Codes } },
      select: { code: true, name: true },
    });

    const l2NameMap = new Map(l2Categories.map((c) => [c.code, c.name]));
    const l1NameMap = new Map(l1Categories.map((c) => [c.code, c.name]));

    const unified = rows.map((row) => {
      const ingredient = row.ingredient;
      if (!ingredient) return null;

      const l2Code = ingredient.l2Code;
      const l2Name = l2NameMap.get(l2Code);
      const l1Name = l2Name
        ? l1NameMap.get(l2Categories.find((c) => c.code === l2Code)?.parentCode || "")
        : undefined;

      return {
        id: row.id,
        sourceId: ingredient.id,
        name: ingredient.name,
        code: ingredient.code,
        l2Code,
        l1Name,
        l2Name,
        currentQty: Number(row.currentQty),
        unit: row.unit || ingredient.stockUnit || "—",
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    let result = unified.filter((item): item is NonNullable<typeof item> => item !== null);

    if (q) {
      const s = q.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.code.toLowerCase().includes(s) ||
          r.l2Name?.toLowerCase().includes(s) ||
          r.l1Name?.toLowerCase().includes(s)
      );
    }

    const totalItems = result.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;
    const paginatedItems = result.slice(skip, skip + pageSize);

    return paginated(paginatedItems, { page: safePage, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取库存失败");
  }
}
