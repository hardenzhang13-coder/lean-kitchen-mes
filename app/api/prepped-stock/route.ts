import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { paginated, internalError } from "@/lib/server/api-response";
import { validateQuery } from "@/lib/server/validate";
import { preppedStockQuerySchema } from "@/lib/server/schemas/prepped-stock";
import { round2 } from "@/lib/shared/prepped-stock";

/** 当前库存列表：份 + g 双字段；join 净料/小料档案与分类名 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const validation = validateQuery(preppedStockQuerySchema, searchParams);
  if (!validation.success) return validation.response;
  const { q, l1, type, page, pageSize } = validation.data;

  try {
    const rows = await prisma.preppedStock.findMany({
      where: { currentPortions: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
    });

    const netIds = [...new Set(rows.map((r) => r.sourceId))];
    const nets = await prisma.netIngredient.findMany({
      where: { id: { in: netIds } },
      select: { id: true, code: true, name: true, l2Code: true, deletedAt: true },
    });
    const netMap = new Map(nets.map((n) => [n.id, n]));
    const l2Codes = [...new Set(nets.map((n) => n.l2Code).filter((x): x is string => !!x))];
    const l2Cats = await prisma.ingredientCategoryL2.findMany({
      where: { code: { in: l2Codes } },
      select: { code: true, name: true, parentCode: true },
    });
    const l1Codes = [...new Set(l2Cats.map((c) => c.parentCode).filter((x): x is string => !!x))];
    const l1Cats = await prisma.ingredientCategoryL1.findMany({
      where: { code: { in: l1Codes } },
      select: { code: true, name: true },
    });
    const l2Map = new Map(l2Cats.map((c) => [c.code, c]));
    const l1Map = new Map(l1Cats.map((c) => [c.code, c.name]));

    let unified = rows.map((r) => {
      const net = netMap.get(r.sourceId);
      const l2 = net?.l2Code ? l2Map.get(net.l2Code) : undefined;
      const l1Name = l2?.parentCode ? l1Map.get(l2.parentCode) : undefined;
      return {
        key: `${r.sourceType}:${r.sourceId}`,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        code: net?.code ?? "",
        name: net?.name ?? "（档案已删除）",
        l1Name: l1Name ?? "—",
        l2Name: l2?.name ?? "—",
        portions: round2(Number(r.currentPortions)),
        qtyG: round2(Number(r.currentQty)),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    const availableL1 = [...new Set(unified.map((row) => row.l1Name))]
      .filter((name) => name !== "—")
      .sort((a, b) => a.localeCompare(b, "zh"));

    if (q) {
      const kw = q.toLowerCase();
      unified = unified.filter((r) => r.name.toLowerCase().includes(kw) || r.code.toLowerCase().includes(kw));
    }
    if (type) unified = unified.filter((r) => r.sourceType === type);
    if (l1) unified = unified.filter((r) => r.l1Name === l1);
    unified.sort((a, b) =>
      a.l1Name === b.l1Name
        ? a.l2Name === b.l2Name
          ? a.code.localeCompare(b.code)
          : a.l2Name.localeCompare(b.l2Name, "zh")
        : a.l1Name.localeCompare(b.l1Name, "zh")
    );

    const paged = unified.slice((page - 1) * pageSize, page * pageSize);
    const response = paginated(paged, {
      page,
      pageSize,
      totalItems: unified.length,
      totalPages: Math.max(1, Math.ceil(unified.length / pageSize)),
    });
    const body = await response.json();
    return NextResponse.json(
      { ...body, filters: { availableL1 } },
      { status: response.status }
    );
  } catch (e) {
    void e;
    return internalError("获取净菜库存失败");
  }
}
