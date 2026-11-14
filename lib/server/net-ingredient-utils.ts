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
 * 净料单价始终按「来源原料当前每斤单价 ÷ (出成率/100)」派生。
 * 缺少来源价格或出成率无效时返回 null。
 */
export async function calculateUnitPrice(
  sourceIngredientId: number,
  yieldRate: number
): Promise<number | null> {
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

export interface NetIngredientPriceInput {
  yieldRate?: unknown;
  processingFeePerJin?: unknown;
  grossMarginRate?: unknown;
  packageSpec?: unknown;
  sourceIngredient?: {
    pricePerJin?: unknown;
  } | null;
}

export interface DerivedNetIngredientPrices {
  unitPrice: number | null;
  grossMarginRate: number;
  costPricePerJin: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
}

/** 前后端价格链路统一入口：净料单价永远取当前来源原料价格。 */
export function deriveNetIngredientPrices(
  row: NetIngredientPriceInput
): DerivedNetIngredientPrices {
  const unitPrice = calcNetUnitPrice({
    pricePerJin: row.sourceIngredient?.pricePerJin,
    yieldRate: Number(row.yieldRate),
  });
  const grossMarginRate =
    row.grossMarginRate == null || row.grossMarginRate === ""
      ? 0
      : Number(row.grossMarginRate);
  const costPrice = calcCostPricePerJin(
    unitPrice,
    row.processingFeePerJin
  );
  const outPrice = calcOutPricePerJin(costPrice, grossMarginRate);

  return {
    unitPrice,
    grossMarginRate: Number.isFinite(grossMarginRate) ? grossMarginRate : 0,
    costPricePerJin: costPrice,
    outPricePerJin: outPrice,
    standardPackagePrice:
      outPrice != null
        ? calcStandardPackagePrice(outPrice, row.packageSpec)
        : null,
  };
}

/**
 * 净料行序列化：附加价格体系的计算字段（不落库，实时计算）。
 * - costPricePerJin        成本价（元/斤）= 净料单价 + 封装加工费
 * - outPricePerJin         出库价（元/斤）= 成本价 ÷ (1 - 毛利率/100)，空毛利率 = 0
 * - standardPackagePrice   标准规格价格（元/份）= 出库价 × 包装规格(g) ÷ 500
 */
export function serializeNetIngredient<T extends {
  unitPrice: unknown;
  yieldRate?: unknown;
  processingFeePerJin?: unknown;
  grossMarginRate?: unknown;
  packageSpec?: unknown;
  sourceIngredient?: {
    pricePerJin?: unknown;
  } | null;
}>(
  row: T
): Omit<T, "unitPrice" | "grossMarginRate"> & {
  unitPrice: number | null;
  grossMarginRate: number;
  costPricePerJin: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
} {
  const prices = deriveNetIngredientPrices(row);
  return {
    ...row,
    ...prices,
  };
}
