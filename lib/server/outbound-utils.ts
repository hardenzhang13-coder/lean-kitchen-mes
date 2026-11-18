// 出库单行构建（创建出库单与报价预览共用）：
// 门店主体以排程切配工单为计划口径，切配中心主体以内部生产单明细为计划口径，
// 统一联查净菜档案出库价与当前库存。

import type { Prisma } from "@prisma/client";
import { round2 } from "@/lib/shared/prepped-stock";
import { calcStandardPackagePrice } from "@/lib/shared/net-price";
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
  /** 标准规格价格（元/份）= 出库价 × 封装规格 ÷ 500，即每份出库单价 */
  standardPackagePrice: number | null;
  prepStatus: "normal" | "insufficient" | "unfinished";
  /** 默认出库份数 = min(计划份数, 库存份数)；未切配 = 0 */
  suggestedPortions: number;
}

interface RawOutboundLine {
  sourceType: string;
  sourceId: number;
  itemCode: string | null;
  itemName: string | null;
  l2Code: string | null;
  packageSpec: number | null;
  /** 计划量（g）；与 requiredPortions 二选一，另一个由封装规格换算 */
  requiredQty: number | null;
  /** 计划份数；内部生产单直接给出，避免 g÷pkg 往返误差 */
  requiredPortions: number | null;
  /** 来源是否已完成（切配工单 completed / 内部生产单 已完成） */
  prepared: boolean;
}

async function buildOutboundLines(
  tx: Prisma.TransactionClient | PrismaClientLike,
  rawLines: RawOutboundLine[]
): Promise<OutboundLine[]> {
  if (!rawLines.length) return [];

  const netIds = [...new Set(rawLines.map((line) => line.sourceId))];
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
        packageSpec: true,
        l2Code: true,
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
  const stockMap = new Map(
    stockRows.map((s) => [`${s.sourceType}:${s.sourceId}`, Number(s.currentPortions)])
  );
  const l2Map = new Map(l2Cats.map((c) => [c.code, c]));
  const l1Name = new Map(l1Cats.map((c) => [c.code, c.name]));

  return rawLines.map((raw) => {
    const key = `${raw.sourceType}:${raw.sourceId}`;
    const net = netMap.get(raw.sourceId);
    const itemName = raw.itemName ?? net?.name ?? `净料 #${raw.sourceId}`;
    const pkg = raw.packageSpec ?? (net?.packageSpec != null ? Number(net.packageSpec) : null);
    if (!pkg || pkg <= 0) throw new Error(`${itemName} 缺少封装规格，无法按份出库`);

    const requiredPortions =
      raw.requiredPortions != null
        ? round2(raw.requiredPortions)
        : raw.requiredQty != null
          ? round2(raw.requiredQty / pkg)
          : 0;
    const requiredQty =
      raw.requiredQty != null ? round2(raw.requiredQty) : round2(requiredPortions * pkg);
    const available = round2(stockMap.get(key) ?? 0);
    const price = net ? deriveNetIngredientPrices(net).outPricePerJin : null;

    const prepStatus: OutboundLine["prepStatus"] = !raw.prepared
      ? "unfinished"
      : available < requiredPortions
        ? "insufficient"
        : "normal";

    const l2Code = raw.l2Code ?? net?.l2Code ?? null;
    const l2 = l2Code ? l2Map.get(l2Code) : undefined;

    return {
      key,
      sourceType: raw.sourceType,
      sourceId: raw.sourceId,
      itemCode: net?.code ?? raw.itemCode,
      itemName,
      l1Name: l2?.parentCode ? l1Name.get(l2.parentCode) ?? null : null,
      l2Name: l2?.name ?? null,
      packageSpec: pkg,
      requiredPortions,
      requiredQty,
      availablePortions: available,
      pricePerJin: price,
      standardPackagePrice: calcStandardPackagePrice(price, pkg),
      prepStatus,
      suggestedPortions: prepStatus === "unfinished" ? 0 : Math.min(requiredPortions, available),
    };
  });
}

/** 门店出库：以排程切配工单为计划口径 */
export async function getOutboundLines(
  tx: Prisma.TransactionClient | PrismaClientLike,
  scheduleId: number
): Promise<OutboundLine[]> {
  const cuttingOrders = await tx.cuttingOrder.findMany({
    where: { scheduleId },
    orderBy: { id: "asc" },
  });
  if (!cuttingOrders.length) throw new Error("该排程没有切配工单，无法出库");

  return buildOutboundLines(
    tx,
    cuttingOrders.map((c) => ({
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      itemCode: c.sourceCode,
      itemName: c.itemName,
      l2Code: c.l2Code,
      packageSpec: c.packageSpec != null ? Number(c.packageSpec) : null,
      requiredQty: Number(c.requiredQty),
      requiredPortions: null,
      prepared: c.status === "completed",
    }))
  );
}

/** 切配中心出库：以内部生产单明细为计划口径 */
export async function getSelfOrderOutboundLines(
  tx: Prisma.TransactionClient | PrismaClientLike,
  selfOrderId: number
): Promise<OutboundLine[]> {
  const order = await tx.selfProductionOrder.findUnique({
    where: { id: selfOrderId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!order) throw new Error("内部生产单不存在");
  if (!order.items.length) throw new Error("该内部生产单没有明细，无法出库");

  // 与门店口径一致：只有完成生产后才算已备货；进行中的行默认不出库
  const prepared = order.status === "已完成";

  return buildOutboundLines(
    tx,
    order.items.map((item) => ({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      itemCode: null,
      itemName: null,
      l2Code: null,
      packageSpec: null,
      requiredQty: null,
      requiredPortions: Number(item.portions),
      prepared,
    }))
  );
}

type PrismaClientLike = Pick<
  Prisma.TransactionClient,
  | "cuttingOrder"
  | "selfProductionOrder"
  | "netIngredient"
  | "preppedStock"
  | "ingredientCategoryL2"
  | "ingredientCategoryL1"
>;
