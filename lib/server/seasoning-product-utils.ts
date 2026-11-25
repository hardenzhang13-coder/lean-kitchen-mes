import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { calcNetUnitPrice } from "@/lib/shared/spec-parser";
import { deriveSeasoningProductPrices } from "@/lib/shared/seasoning-spec";

// 调料产物的服务端工具：单价派生 + 行序列化。
// 与 net-ingredient-utils.ts 同构，来源档案是调味品原料（纯转化口径）。

type UnitPriceDatabase = Pick<Prisma.TransactionClient, "ingredient">;

export interface CalculateUnitPriceInput {
  sourceIngredientId?: number | null;
  yieldRate?: number | null;
}

/** 计算产物单价（元/斤）= 来源调味品当前每斤单价 ÷ (出成率/100) */
export async function calculateSeasoningProductUnitPrice(
  input: CalculateUnitPriceInput,
  database: UnitPriceDatabase = prisma
): Promise<number | null> {
  if (!input.sourceIngredientId || !input.yieldRate) return null;

  const ingredient = await database.ingredient.findUnique({
    where: { id: input.sourceIngredientId },
    select: { pricePerJin: true },
  });

  return calcNetUnitPrice({
    pricePerJin: ingredient?.pricePerJin,
    yieldRate: input.yieldRate,
  });
}

export interface SeasoningProductSerializeInput {
  unitPrice: unknown;
  yieldRate?: unknown;
  processingFeePerJin?: unknown;
  grossMarginRate?: unknown;
  packageSpec?: unknown;
  sourceIngredient?: {
    pricePerJin?: unknown;
    name?: unknown;
    purchaseSpec?: unknown;
  } | null;
}

/**
 * 产物行序列化：附加价格体系的计算字段（不落库，实时计算）。
 * - costPricePerJin        成本价（元/斤）= 单价 + 封装加工费
 * - outPricePerJin         出库价（元/斤）= 成本价 ÷ (1 - 毛利率/100)，空毛利率 = 0
 * - standardPackagePrice   标准规格价（元/份）= 出库价 × 封装规格(g) ÷ 500
 */
export function serializeSeasoningProduct<T extends SeasoningProductSerializeInput>(
  row: T
): Omit<T, "unitPrice" | "grossMarginRate"> & {
  unitPrice: number | null;
  grossMarginRate: number;
  costPricePerJin: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
} {
  const prices = deriveSeasoningProductPrices(row);
  return {
    ...row,
    ...prices,
  };
}
