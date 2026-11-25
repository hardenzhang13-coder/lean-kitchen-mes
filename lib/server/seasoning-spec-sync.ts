import type { Prisma } from "@prisma/client";
import { recalcDishCosts } from "@/lib/server/bom-package-sync";

function lineCost(pricePerJin: number | null, amountG: number): number | null {
  if (pricePerJin == null || !Number.isFinite(amountG)) return null;
  return Number(((pricePerJin * amountG) / 500).toFixed(4));
}

/**
 * 调料产物的出库价变更后，把引用它的 BOM 行成本按新价重算（按克用量保留不动）。
 * BOM 行成本仅是缓存，读取时以实时价格为准（见 lib/server/dish-costing.ts）。
 */
export async function syncBomCostsForSeasoningProduct(
  tx: Prisma.TransactionClient,
  specId: number,
  outPricePerJin: number | null
): Promise<{ dishIds: number[]; rows: number }> {
  const rows = await tx.dishSeasoningDetail.findMany({
    where: { specId },
    select: { id: true, dishId: true, amountG: true },
  });

  if (rows.length === 0) {
    return { dishIds: [], rows: 0 };
  }

  for (const row of rows) {
    await tx.dishSeasoningDetail.update({
      where: { id: row.id },
      data: { cost: lineCost(outPricePerJin, Number(row.amountG)) },
    });
  }

  const dishIds = [...new Set(rows.map((row) => row.dishId))];
  await recalcDishCosts(tx, dishIds);

  return { dishIds, rows: rows.length };
}
