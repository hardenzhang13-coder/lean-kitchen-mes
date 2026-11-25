import { type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { deriveNetIngredientPrices } from "@/lib/server/net-ingredient-utils";
import { computeSauceCostPrices } from "@/lib/server/sauce-utils";
import { deriveSeasoningProductPrices } from "@/lib/shared/seasoning-spec";
import { calcOutPricePerJin } from "@/lib/shared/net-price";
import { resolveNetBomAmountG } from "@/lib/shared/bom-amount";
import { round2 } from "@/lib/shared/prepped-stock";

type DishCostDatabase = Pick<
  Prisma.TransactionClient,
  | "dishNetDetail"
  | "dishMinorDetail"
  | "dishSeasoningDetail"
  | "dishSauceDetail"
  | "ingredient"
  | "sauceIngredient"
  | "seasoningProduct"
>;

function lineCost(pricePerJin: number | null, amountG: number): number | null {
  if (pricePerJin == null || !Number.isFinite(amountG)) return null;
  return Number(((pricePerJin * amountG) / 500).toFixed(4));
}

export type DishCostBreakdown = {
  main: number;
  support: number;
  minor: number;
  seasoning: number;
  sauce: number;
  total: number;
};

/**
 * 菜品的当前成本必须按当前食材价格重新汇总，不能直接信任 Dish.cost
 * 或历史 BOM 行成本快照。返回五类食材小计与合计，供列表、详情、工作台共用。
 */
export async function getCurrentDishCostBreakdownMap(
  dishIds: number[],
  database: DishCostDatabase | PrismaClient = prisma
): Promise<Map<number, DishCostBreakdown>> {
  const uniqueIds = [...new Set(dishIds.filter((id) => Number.isInteger(id)))];
  const result = new Map<number, DishCostBreakdown>();
  if (uniqueIds.length === 0) return result;

  const [netDetails, minorDetails, seasoningDetails, sauceDetails] = await Promise.all([
      database.dishNetDetail.findMany({
        where: { dishId: { in: uniqueIds } },
        select: {
          dishId: true,
          role: true,
          amountG: true,
          netIngredient: {
            select: {
              yieldRate: true,
              processingFeePerJin: true,
              grossMarginRate: true,
              packageSpec: true,
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
              packageSpec: true,
              sourceIngredient: { select: { pricePerJin: true } },
            },
          },
        },
      }),
      database.dishSeasoningDetail.findMany({
        where: { dishId: { in: uniqueIds } },
        select: {
          dishId: true,
          sourceId: true,
          specId: true,
          amountG: true,
          // 新口径：调料产物（specId 行按出库价计价）
          product: {
            select: {
              yieldRate: true,
              processingFeePerJin: true,
              grossMarginRate: true,
              sourceIngredient: { select: { pricePerJin: true } },
            },
          },
        },
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
    ]);

  // 旧口径行（specId 空）直引调味品原料，按当前每斤单价计价（kind=seasoning 边界）
  const legacyIds = [
    ...new Set(
      seasoningDetails.filter((row) => row.specId == null).map((row) => row.sourceId)
    ),
  ];
  const legacySeasonings =
    legacyIds.length > 0
      ? await database.ingredient.findMany({
          where: { id: { in: legacyIds }, kind: "seasoning" },
          select: { id: true, pricePerJin: true },
        })
      : [];
  const legacySeasoningPrice = new Map(
    legacySeasonings.map((row) => [
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

  for (const id of uniqueIds) {
    result.set(id, {
      main: 0,
      support: 0,
      minor: 0,
      seasoning: 0,
      sauce: 0,
      total: 0,
    });
  }

  const addCost = (
    dishId: number,
    key: Exclude<keyof DishCostBreakdown, "total">,
    cost: number | null
  ) => {
    if (cost == null) return;
    const row = result.get(dishId);
    if (!row) return;
    row[key] = round2(row[key] + cost);
    row.total = round2(row.total + cost);
  };

  for (const row of netDetails) {
    const prices = deriveNetIngredientPrices(row.netIngredient);
    const amountG = resolveNetBomAmountG(row.amountG, row.netIngredient.packageSpec);
    const cost = lineCost(prices.outPricePerJin, amountG);
    addCost(row.dishId, row.role === "support" ? "support" : "main", cost);
  }
  for (const row of minorDetails) {
    const prices = deriveNetIngredientPrices(row.netIngredient);
    const amountG = resolveNetBomAmountG(row.amountG, row.netIngredient.packageSpec);
    const cost = lineCost(prices.outPricePerJin, amountG);
    addCost(row.dishId, "minor", cost);
  }
  for (const row of seasoningDetails) {
    // 新口径（specId 行）：产物按克计价，行成本 = 产物出库价 × 用量g ÷ 500
    if (row.specId != null && row.product) {
      const prices = deriveSeasoningProductPrices(row.product);
      addCost(row.dishId, "seasoning", lineCost(prices.outPricePerJin, Number(row.amountG)));
      continue;
    }
    // 旧口径行：调味品原料每斤单价 × 用量g ÷ 500
    const cost = lineCost(
      legacySeasoningPrice.get(row.sourceId) ?? null,
      Number(row.amountG)
    );
    addCost(row.dishId, "seasoning", cost);
  }
  for (const row of sauceDetails) {
    const cost = lineCost(
      sauceOutPrice.get(row.sauceId) ?? null,
      Number(row.amountG)
    );
    addCost(row.dishId, "sauce", cost);
  }

  return result;
}

/** 菜品当前成本合计（元/份）：列表与工作台口径。 */
export async function getCurrentDishCostMap(
  dishIds: number[],
  database: DishCostDatabase | PrismaClient = prisma
): Promise<Map<number, number>> {
  const breakdown = await getCurrentDishCostBreakdownMap(dishIds, database);
  return new Map(
    [...breakdown.entries()].map(([dishId, cost]) => [dishId, cost.total])
  );
}
