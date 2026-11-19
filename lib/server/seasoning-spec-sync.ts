import type { Prisma } from "@prisma/client";
import { recalcDishCosts } from "@/lib/server/bom-package-sync";

function lineCost(pricePerJin: number | null, amountG: number): number | null {
  if (pricePerJin == null || !Number.isFinite(amountG)) return null;
  return Number(((pricePerJin * amountG) / 500).toFixed(4));
}

/**
 * 标准化调料的标准规格变更后，把引用它的 BOM 行同步到新规格并重算成本。
 * amountG 仅作为缓存列，packageSpec 是唯一真源。
 */
export async function syncBomAmountsForStandardSeasoning(
  tx: Prisma.TransactionClient,
  specId: number,
  packageSpec: number,
  outPricePerJin: number | null
): Promise<{ dishIds: number[]; rows: number }> {
  const rows = await tx.dishSeasoningDetail.findMany({
    where: { specId },
    select: { id: true, dishId: true },
  });

  if (rows.length === 0) {
    return { dishIds: [], rows: 0 };
  }

  await tx.dishSeasoningDetail.updateMany({
    where: { specId },
    data: {
      amountG: packageSpec,
      cost: lineCost(outPricePerJin, packageSpec),
    },
  });

  const dishIds = [...new Set(rows.map((row) => row.dishId))];
  await recalcDishCosts(tx, dishIds);

  return { dishIds, rows: rows.length };
}
