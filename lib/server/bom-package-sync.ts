import type { Prisma } from "@prisma/client";
import { deriveNetIngredientPrices } from "@/lib/server/net-ingredient-utils";
import { getCurrentDishCostBreakdownMap } from "@/lib/server/dish-costing";

function lineCost(pricePerJin: number | null, amountG: number): number | null {
  if (pricePerJin == null || !Number.isFinite(amountG)) return null;
  return Number(((pricePerJin * amountG) / 500).toFixed(4));
}

/** 批量重算菜品总成本（复用实时成本口径，不复制公式） */
export async function recalcDishCosts(
  tx: Prisma.TransactionClient,
  dishIds: number[]
): Promise<void> {
  const uniqueIds = [...new Set(dishIds.filter((id) => Number.isInteger(id)))];
  if (uniqueIds.length === 0) return;

  const costMap = await getCurrentDishCostBreakdownMap(uniqueIds, tx);
  for (const dishId of uniqueIds) {
    const cost = costMap.get(dishId)?.total ?? 0;
    await tx.dish.update({ where: { id: dishId }, data: { cost } });
  }
}

/**
 * 净料/小料封装规格变更后，把引用它的 BOM 行同步到新规格并重算成本。
 * amountG 仅作为缓存列，packageSpec 是唯一真源。
 */
export async function syncBomAmountsForNetIngredient(
  tx: Prisma.TransactionClient,
  netIngredientId: number,
  packageSpec: number
): Promise<{ dishIds: number[]; netRows: number; minorRows: number }> {
  const net = await tx.netIngredient.findUnique({
    where: { id: netIngredientId },
    select: {
      id: true,
      unitPrice: true,
      yieldRate: true,
      processingFeePerJin: true,
      grossMarginRate: true,
      sourceIngredient: { select: { pricePerJin: true } },
    },
  });
  if (!net) throw new Error("净料不存在或已删除");

  const [netRows, minorRows] = await Promise.all([
    tx.dishNetDetail.findMany({
      where: { netIngId: netIngredientId },
      select: { id: true, dishId: true },
    }),
    tx.dishMinorDetail.findMany({
      where: { netIngId: netIngredientId },
      select: { id: true, dishId: true },
    }),
  ]);

  const prices = deriveNetIngredientPrices(net);
  const cost = lineCost(prices.outPricePerJin, packageSpec);

  if (netRows.length > 0) {
    await tx.dishNetDetail.updateMany({
      where: { netIngId: netIngredientId },
      data: { amountG: packageSpec, cost, spec: `${packageSpec}g` },
    });
  }
  if (minorRows.length > 0) {
    await tx.dishMinorDetail.updateMany({
      where: { netIngId: netIngredientId },
      data: { amountG: packageSpec, cost },
    });
  }

  const dishIds = [...new Set([...netRows, ...minorRows].map((row) => row.dishId))];
  if (dishIds.length > 0) {
    await recalcDishCosts(tx, dishIds);
  }

  return { dishIds, netRows: netRows.length, minorRows: minorRows.length };
}
