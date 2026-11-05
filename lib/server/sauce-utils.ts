import { prisma } from "@/lib/server/prisma";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";
import {
  calcCostPricePerJin,
  calcOutPricePerJin,
  calcStandardPackagePrice,
} from "@/lib/shared/net-price";
import {
  applyProcessingFee,
  calcRecipeLineCost,
  calcSauceCostPricePerJin,
} from "@/lib/shared/sauce-price";

// 酱料价格体系（服务端唯一真源）。
// 自制：配方行（净料/小料按出库价、调料按每斤单价）→ 成本价 → 出库价
// 外购：每斤单价（采购规格自动换算）→ 成本价 → 出库价
// 与净料完全同链：出库价 = 成本价 ÷ (1 - 毛利率/100)，真毛利率口径。

export interface RecipeLineInput {
  lineType: "net" | "seasoning";
  refId: number;
  amountG: number;
}

export interface ResolvedRecipeLine extends RecipeLineInput {
  name: string;
  /** 行单价（元/斤）：净料/小料 = 出库价；调料 = 每斤单价 */
  linePricePerJin: number | null;
  /** 行成本（元） */
  cost: number | null;
}

/**
 * 解析配方行：校验引用存在（净料未删除；调料必须属于 SEA 调味品子树），
 * 并按当前价格体系计算行单价与行成本。非法引用抛错（由路由捕获转 400）。
 */
export async function resolveRecipeLines(
  lines: RecipeLineInput[]
): Promise<ResolvedRecipeLine[]> {
  const netIds = lines.filter((l) => l.lineType === "net").map((l) => l.refId);
  const seasoningIds = lines.filter((l) => l.lineType === "seasoning").map((l) => l.refId);
  const seasoningL2Codes = await getSeasoningL2Codes();

  const [nets, seasonings] = await Promise.all([
    prisma.netIngredient.findMany({
      where: { id: { in: netIds }, deletedAt: null },
      select: { id: true, name: true, unitPrice: true, processingFeePerJin: true, grossMarginRate: true },
    }),
    prisma.ingredient.findMany({
      where: { id: { in: seasoningIds } },
      select: { id: true, name: true, l2Code: true, pricePerJin: true },
    }),
  ]);

  const netMap = new Map(
    nets.map((n) => {
      const cost = calcCostPricePerJin(n.unitPrice, n.processingFeePerJin);
      const out = calcOutPricePerJin(cost, n.grossMarginRate);
      return [n.id, { name: n.name, price: out }] as const;
    })
  );
  const seasoningMap = new Map(
    seasonings
      .filter((s) => seasoningL2Codes.includes(s.l2Code))
      .map((s) => [s.id, { name: s.name, price: s.pricePerJin != null ? Number(s.pricePerJin) : null }] as const)
  );

  return lines.map((line) => {
    const ref = line.lineType === "net" ? netMap.get(line.refId) : seasoningMap.get(line.refId);
    if (!ref) {
      throw new Error(
        line.lineType === "net"
          ? `配方引用的净料/小料不存在或已删除（refId=${line.refId}）`
          : `配方引用的调料不存在或不属于调味品分类（refId=${line.refId}）`
      );
    }
    const price = ref.price;
    return {
      ...line,
      name: ref.name,
      linePricePerJin: price,
      cost: calcRecipeLineCost(price, line.amountG),
    };
  });
}

/** 计算酱料成本价（元/斤）：自制 = 配方推算 + 加工费；外购 = 每斤单价。 */
export function computeCostPricePerJin(input: {
  type: string;
  pricePerJin?: unknown;
  processingFeePerJin?: unknown;
  recipeLines?: Array<{ cost: number | null; amountG: number }>;
}): number | null {
  if (input.type === "外购") {
    const p = input.pricePerJin != null ? Number(input.pricePerJin) : null;
    return p != null && Number.isFinite(p) && p >= 0 ? p : null;
  }
  if (!input.recipeLines || input.recipeLines.length === 0) return null;
  const bomCost = calcSauceCostPricePerJin(input.recipeLines);
  return applyProcessingFee(bomCost, input.processingFeePerJin);
}

/** 序列化：注入计算字段（不落库，实时计算）。 */
export function serializeSauce<
  T extends { type: string; grossMarginRate?: unknown; pricePerJin?: unknown; packageSpec?: unknown },
>(
  row: T,
  costPricePerJin: number | null
): T & {
  costPricePerJin: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
} {
  const outPrice = calcOutPricePerJin(costPricePerJin, row.grossMarginRate);
  return {
    ...row,
    costPricePerJin,
    outPricePerJin: outPrice,
    standardPackagePrice:
      outPrice != null ? calcStandardPackagePrice(outPrice, row.packageSpec) : null,
  };
}

type SauceWithRecipe = {
  id: number;
  type: string;
  grossMarginRate: unknown;
  pricePerJin: unknown;
  processingFeePerJin: unknown;
  recipeDetails: Array<{ amountG: unknown; cost: unknown }>;
};

/** 批量计算一批酱料的成本价（列表/菜品 BOM 共用）。 */
export async function computeSauceCostPrices(
  sauces: SauceWithRecipe[]
): Promise<Map<number, number | null>> {
  const result = new Map<number, number | null>();
  const homemade = sauces.filter((s) => s.type === "自制");
  const ids = homemade.map((s) => s.id);
  const linesBySauce = new Map<number, Array<{ lineType: "net" | "seasoning"; refId: number; amountG: number }>>();
  if (ids.length > 0) {
    const rows = await prisma.sauceRecipeDetail.findMany({ where: { sauceId: { in: ids } } });
    for (const r of rows) {
      const list = linesBySauce.get(r.sauceId) ?? [];
      list.push({ lineType: r.lineType as "net" | "seasoning", refId: r.refId, amountG: Number(r.amountG) });
      linesBySauce.set(r.sauceId, list);
    }
  }
  for (const sauce of sauces) {
    let cost: number | null;
    if (sauce.type === "外购") {
      cost = computeCostPricePerJin({ type: sauce.type, pricePerJin: sauce.pricePerJin });
    } else {
      const lines = linesBySauce.get(sauce.id) ?? [];
      const resolved = lines.length > 0 ? await resolveRecipeLines(lines) : [];
      cost = computeCostPricePerJin({
        type: sauce.type,
        processingFeePerJin: sauce.processingFeePerJin,
        recipeLines: resolved.map((l) => ({ cost: l.cost, amountG: l.amountG })),
      });
    }
    result.set(sauce.id, cost);
  }
  return result;
}
