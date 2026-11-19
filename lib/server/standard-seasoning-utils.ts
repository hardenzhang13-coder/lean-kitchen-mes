import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { calcNetUnitPrice } from "@/lib/shared/spec-parser";
import { deriveStandardSeasoningPrices } from "@/lib/shared/seasoning-spec";

// 标准化调料的服务端工具：单价派生 + 行序列化。
// 与 net-ingredient-utils.ts 同构，来源档案从原料换成调料。

type UnitPriceDatabase = Pick<Prisma.TransactionClient, "ingredient">;

/**
 * 计算标准化调料单价（元/斤）。
 * 单价始终按「来源调料当前每斤单价 ÷ (出成率/100)」派生。
 */
export async function calculateStandardSeasoningUnitPrice(
  sourceIngredientId: number,
  yieldRate: number,
  database: UnitPriceDatabase = prisma
): Promise<number | null> {
  if (!sourceIngredientId || !yieldRate) return null;

  const ingredient = await database.ingredient.findUnique({
    where: { id: sourceIngredientId },
    select: { pricePerJin: true },
  });

  return calcNetUnitPrice({
    pricePerJin: ingredient?.pricePerJin,
    yieldRate,
  });
}

export interface StandardSeasoningSerializeInput {
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
 * 标准化调料行序列化：附加价格体系的计算字段（不落库，实时计算）。
 * - costPricePerJin        成本价（元/斤）= 单价 + 封装加工费
 * - outPricePerJin         出库价（元/斤）= 成本价 ÷ (1 - 毛利率/100)，空毛利率 = 0
 * - standardPackagePrice   标准规格价（元/份）= 出库价 × 标准规格(g) ÷ 500
 */
export function serializeStandardSeasoning<T extends StandardSeasoningSerializeInput>(
  row: T
): Omit<T, "unitPrice" | "grossMarginRate"> & {
  unitPrice: number | null;
  grossMarginRate: number;
  costPricePerJin: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
} {
  const prices = deriveStandardSeasoningPrices(row);
  return {
    ...row,
    ...prices,
  };
}
