// 出库单行构建（创建出库单与报价预览共用）：以排程切配工单为计划口径，联查净菜档案出库价与当前库存。

import type { Prisma } from "@prisma/client";
import { round2 } from "@/lib/shared/prepped-stock";
import { deriveNetIngredientPrices } from "@/lib/server/net-ingredient-utils";

export interface OutboundLine {
  key: string; // sourceType:sourceId
  sourceType: string;
  sourceId: number;
  itemCode: string | null;
  itemName: string;
  l1Name: string | null;
  l2Name: string | null;
  packageSpec: number;
  requiredPortions: number;
  requiredQty: number;
  availablePortions: number;
  pricePerJin: number | null;
  prepStatus: "normal" | "insufficient" | "unfinished";
  /** 默认出库份数 = min(计划份数, 库存份数)；未切配 = 0 */
  suggestedPortions: number;
}

export async function getOutboundLines(
  tx: Prisma.TransactionClient | PrismaClientLike,
  scheduleId: number
): Promise<OutboundLine[]> {
  const cuttingOrders = await tx.cuttingOrder.findMany({
    where: { scheduleId },
    orderBy: { id: "asc" },
  });
  if (!cuttingOrders.length) throw new Error("该排程没有切配工单，无法出库");

  const netIds = [...new Set(cuttingOrders.map((c) => c.sourceId))];
  const [nets, stockRows, l2Cats, l1Cats] = await Promise.all([
    tx.netIngredient.findMany({
      where: { id: { in: netIds } },
      select: {
        id: true,
        code: true,
        name: true,
        unitPrice: true,
        yieldRate: true,
        processingFeePerJin: true,
        grossMarginRate: true,
        sourceIngredient: { select: { pricePerJin: true } },
      },
    }),
    tx.preppedStock.findMany({ where: { sourceId: { in: netIds } } }),
    tx.ingredientCategoryL2.findMany({
      select: { code: true, name: true, parentCode: true },
    }),
    tx.ingredientCategoryL1.findMany({ select: { code: true, name: true } }),
  ]);
  const netMap = new Map(nets.map((n) => [n.id, n]));
  const stockMap = new Map(stockRows.map((s) => [`${s.sourceType}:${s.sourceId}`, Number(s.currentPortions)]));
  const l2Map = new Map(l2Cats.map((c) => [c.code, c]));
  const l1Name = new Map(l1Cats.map((c) => [c.code, c.name]));

  return cuttingOrders.map((c) => {
    const key = `${c.sourceType}:${c.sourceId}`;
    const pkg = c.packageSpec != null ? Number(c.packageSpec) : null;
    if (!pkg || pkg <= 0) throw new Error(`${c.itemName} 缺少封装规格，无法按份出库`);
    const requiredPortions = round2(Number(c.requiredQty) / pkg);
    const available = round2(stockMap.get(key) ?? 0);

    const net = netMap.get(c.sourceId);
    const price = net
      ? deriveNetIngredientPrices(net).outPricePerJin
      : null;

    const prepStatus: OutboundLine["prepStatus"] =
      c.status !== "completed" ? "unfinished" : available < requiredPortions ? "insufficient" : "normal";

    const l2 = c.l2Code ? l2Map.get(c.l2Code) : undefined;

    return {
      key,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      itemCode: net?.code ?? c.sourceCode,
      itemName: c.itemName,
      l1Name: l2?.parentCode ? l1Name.get(l2.parentCode) ?? null : null,
      l2Name: l2?.name ?? null,
      packageSpec: pkg,
      requiredPortions,
      requiredQty: round2(Number(c.requiredQty)),
      availablePortions: available,
      pricePerJin: price,
      prepStatus,
      suggestedPortions: prepStatus === "unfinished" ? 0 : Math.min(requiredPortions, available),
    };
  });
}

type PrismaClientLike = Pick<Prisma.TransactionClient, "cuttingOrder" | "netIngredient" | "preppedStock" | "ingredientCategoryL2" | "ingredientCategoryL1">;
