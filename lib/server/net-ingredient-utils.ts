import { prisma } from "@/lib/server/prisma";
import { calcNetUnitPrice } from "@/lib/shared/spec-parser";
import {
  calcCostPricePerJin,
  calcOutPricePerJin,
  calcStandardPackagePrice,
} from "@/lib/shared/net-price";

// 净料单价计算（服务端）。
// 合并了此前 app/api/net-ingredients/route.ts 与 [id]/route.ts 两处完全重复的
// calculateUnitPrice 实现，作为唯一真源。

/**
 * 计算净料单价（元/斤）。
 * - 若调用方已提供 unitPrice（providedUnitPrice），直接采用；
 * - 否则按「原料每斤单价 ÷ (出成率/100)」自动推算；
 * - 缺少原料每斤单价或出成率无效时返回 null（由用户手动填写）。
 */
export async function calculateUnitPrice(
  sourceIngredientId: number,
  yieldRate: number,
  providedUnitPrice?: number | null
): Promise<number | null> {
  if (providedUnitPrice != null && !Number.isNaN(providedUnitPrice)) {
    return providedUnitPrice;
  }

  if (!sourceIngredientId || !yieldRate) return null;

  const ingredient = await prisma.ingredient.findUnique({
    where: { id: sourceIngredientId },
    select: { pricePerJin: true },
  });

  return calcNetUnitPrice({
    pricePerJin: ingredient?.pricePerJin,
    yieldRate,
  });
}

/**
 * 净料行序列化：附加价格体系的计算字段（不落库，实时计算）。
 * - costPricePerJin        成本价（元/斤）= 净料单价 + 封装加工费
 * - outPricePerJin         出库价（元/斤）= 成本价 ÷ (1 - 毛利率/100)，空毛利率 = 0
 * - standardPackagePrice   标准规格价格（元/份）= 出库价 × 包装规格(g) ÷ 500
 */
export function serializeNetIngredient<T extends {
  unitPrice: unknown;
  processingFeePerJin?: unknown;
  grossMarginRate?: unknown;
  packageSpec?: unknown;
}>(row: T): T & {
  costPricePerJin: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
} {
  const costPrice = calcCostPricePerJin(row.unitPrice, row.processingFeePerJin);
  const outPrice = calcOutPricePerJin(costPrice, row.grossMarginRate);
  return {
    ...row,
    costPricePerJin: costPrice,
    outPricePerJin: outPrice,
    standardPackagePrice: outPrice != null ? calcStandardPackagePrice(outPrice, row.packageSpec) : null,
  };
}
