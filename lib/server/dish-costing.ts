import { type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";
import { deriveNetIngredientPrices } from "@/lib/server/net-ingredient-utils";
import { computeSauceCostPrices } from "@/lib/server/sauce-utils";
import { calcOutPricePerJin } from "@/lib/shared/net-price";
import { round2 } from "@/lib/shared/prepped-stock";

type DishCostDatabase = Pick<
  Prisma.TransactionClient,
  | "dishNetDetail"
  | "dishMinorDetail"
  | "dishSeasoningDetail"
  | "dishSauceDetail"
  | "ingredient"
  | "sauceIngredient"
>;

function lineCost(pricePerJin: number | null, amountG: number): number | null {
  if (pricePerJin == null || !Number.isFinite(amountG)) return null;
  return Number(((pricePerJin * amountG) / 500).toFixed(4));
}

/**
 * 菜品的当前成本必须按当前食材价格重新汇总，不能直接信任 Dish.cost
 * 或历史 BOM 行成本快照。
 */
export async function getCurrentDishCostMap(
  dishIds: number[],
  database: DishCostDatabase | PrismaClient = prisma
): Promise<Map<number, number>> {
  const uniqueIds = [...new Set(dishIds.filter((id) => Number.isInteger(id)))];
  const result = new Map<number, number>();
  if (uniqueIds.length === 0) return result;

  const [netDetails, minorDetails, seasoningDetails, sauceDetails, seasoningL2Codes] =
    await Promise.all([
      database.dishNetDetail.findMany({
        where: { dishId: { in: uniqueIds } },
        select: {
          dishId: true,
          amountG: true,
          netIngredient: {
            select: {
              yieldRate: true,
              processingFeePerJin: true,
              grossMarginRate: true,
              sourceIngredient: { select: { pricePerJin: true } },
            },
          },
        },
      }),
      database.dishMinorDetail.findMany({
        where: { dishId: { in: uniqueIds } },
        select: {
          dishId: true,
          amountG: true,
          netIngredient: {
            select: {
              yieldRate: true,
              processingFeePerJin: true,
              grossMarginRate: true,
              sourceIngredient: { select: { pricePerJin: true } },
            },
          },
        },
      }),
      database.dishSeasoningDetail.findMany({
        where: { dishId: { in: uniqueIds } },
        select: { dishId: true, sourceId: true, amountG: true },
      }),
      database.dishSauceDetail.findMany({
        where: { dishId: { in: uniqueIds } },
        select: {
          dishId: true,
          sauceId: true,
          amountG: true,
          sauce: {
            select: {
              id: true,
              type: true,
              pricePerJin: true,
              grossMarginRate: true,
              processingFeePerJin: true,
              recipeDetails: { select: { amountG: true, cost: true } },
            },
          },
        },
      }),
      getSeasoningL2Codes(),
    ]);

  const seasoningIds = [...new Set(seasoningDetails.map((row) => row.sourceId))];
  const seasonings =
    seasoningIds.length > 0
      ? await database.ingredient.findMany({
          where: {
            id: { in: seasoningIds },
            l2Code: { in: seasoningL2Codes },
          },
          select: { id: true, pricePerJin: true },
        })
      : [];
  const seasoningPrice = new Map(
    seasonings.map((row) => [
      row.id,
      row.pricePerJin != null ? Number(row.pricePerJin) : null,
    ])
  );

  const sauceRows = [
    ...new Map(
      sauceDetails
        .map((row) => row.sauce)
        .filter((row): row is NonNullable<typeof row> => row != null)
        .map((row) => [row.id, row])
    ).values(),
  ];
  const sauceCosts = await computeSauceCostPrices(sauceRows);
  const sauceOutPrice = new Map(
    sauceRows.map((row) => [
      row.id,
      calcOutPricePerJin(sauceCosts.get(row.id) ?? null, row.grossMarginRate),
    ])
  );

  for (const id of uniqueIds) result.set(id, 0);

  for (const row of netDetails) {
    const prices = deriveNetIngredientPrices(row.netIngredient);
    const cost = lineCost(prices.outPricePerJin, Number(row.amountG));
    if (cost != null) {
      result.set(row.dishId, round2((result.get(row.dishId) ?? 0) + cost));
    }
  }
  for (const row of minorDetails) {
    const prices = deriveNetIngredientPrices(row.netIngredient);
    const cost = lineCost(prices.outPricePerJin, Number(row.amountG));
    if (cost != null) {
      result.set(row.dishId, round2((result.get(row.dishId) ?? 0) + cost));
    }
  }
  for (const row of seasoningDetails) {
    const cost = lineCost(
      seasoningPrice.get(row.sourceId) ?? null,
      Number(row.amountG)
    );
    if (cost != null) {
      result.set(row.dishId, round2((result.get(row.dishId) ?? 0) + cost));
    }
  }
  for (const row of sauceDetails) {
    const cost = lineCost(
      sauceOutPrice.get(row.sauceId) ?? null,
      Number(row.amountG)
    );
    if (cost != null) {
      result.set(row.dishId, round2((result.get(row.dishId) ?? 0) + cost));
    }
  }

  return result;
}
