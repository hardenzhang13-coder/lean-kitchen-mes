import type { Prisma, PrismaClient } from "@prisma/client";
import { calcGrossNeedGrams } from "@/lib/shared/gross-need";
import { GRAMS_PER_JIN } from "@/lib/shared/unit-conversion";

export type SelfProductionClient = PrismaClient | Prisma.TransactionClient;

export interface SelfProductionResolvedItem {
  sourceType: "net" | "minor";
  sourceId: number;
  portions: number;
}

/**
 * 校验并规范化内部生产单明细。
 * - sourceType 由净料二级分类（MIN）服务端派生，不信任客户端；
 * - 封装规格缺失直接拦截（无法折算切配量，也无法按份入库）。
 */
export async function resolveSelfProductionItems(
  prisma: SelfProductionClient,
  items: Array<{ sourceId: number; portions: number }>
): Promise<SelfProductionResolvedItem[]> {
  if (items.length === 0) {
    throw new Error("请至少选择一种净料或小料");
  }

  const ids = [...new Set(items.map((item) => item.sourceId))];
  const nets = await prisma.netIngredient.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, name: true, packageSpec: true, l2Code: true },
  });
  if (nets.length !== ids.length) {
    throw new Error("存在无效的净料，请刷新后重试");
  }

  const netMap = new Map(nets.map((net) => [net.id, net]));
  const l2Codes = [...new Set(nets.map((net) => net.l2Code))];
  const l2Rows = await prisma.ingredientCategoryL2.findMany({
    where: { code: { in: l2Codes } },
    select: { code: true, parentCode: true },
  });
  const minorCodes = new Set(
    l2Rows.filter((row) => row.parentCode === "MIN").map((row) => row.code)
  );

  return items.map((item) => {
    const net = netMap.get(item.sourceId);
    if (!net) throw new Error("存在无效的净料，请刷新后重试");
    const packageSpec = net.packageSpec != null ? Number(net.packageSpec) : 0;
    if (!(packageSpec > 0)) {
      throw new Error(`「${net.name}」缺少封装规格，不能进入内部生产单`);
    }
    return {
      sourceType: minorCodes.has(net.l2Code) ? "minor" : "net",
      sourceId: net.id,
      portions: Math.round(item.portions * 100) / 100,
    };
  });
}

export interface SelfProductionDetailItem {
  id: number;
  sourceType: string;
  sourceId: number;
  itemCode: string;
  itemName: string;
  l1Name: string;
  l2Name: string;
  l2Code: string;
  packageSpec: number | null;
  unit: string;
  yieldRate: number | null;
  portions: number;
  requiredQty: number | null;
  grossNeed: number | null;
  grossNeedJin: number | null;
}

/** 为内部生产单明细补全净料档案字段与计算量（切配克数、毛料需求）。 */
export async function buildSelfProductionDetailItems(
  prisma: SelfProductionClient,
  items: Array<{ id: number; sourceType: string; sourceId: number; portions: unknown }>
): Promise<SelfProductionDetailItem[]> {
  if (items.length === 0) return [];

  const round2 = (value: number) => Math.round(value * 100) / 100;
  const ids = [...new Set(items.map((item) => item.sourceId))];
  const nets = await prisma.netIngredient.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, name: true, unit: true, packageSpec: true, yieldRate: true, l2Code: true },
  });
  const netMap = new Map(nets.map((net) => [net.id, net]));
  const l2Codes = [...new Set(nets.map((net) => net.l2Code))];
  const l2Rows = await prisma.ingredientCategoryL2.findMany({
    where: { code: { in: l2Codes } },
    select: { code: true, name: true, parentCode: true },
  });
  const l2Map = new Map(l2Rows.map((row) => [row.code, row]));
  const l1Codes = [...new Set(l2Rows.map((row) => row.parentCode).filter((code): code is string => !!code))];
  const l1Rows = await prisma.ingredientCategoryL1.findMany({
    where: { code: { in: l1Codes } },
    select: { code: true, name: true },
  });
  const l1Map = new Map(l1Rows.map((row) => [row.code, row]));

  return items.map((item) => {
    const net = netMap.get(item.sourceId);
    const packageSpec = net?.packageSpec != null ? Number(net.packageSpec) : null;
    const yieldRate = net?.yieldRate != null ? Number(net.yieldRate) : null;
    const portions = round2(Number(item.portions));
    const requiredQty =
      packageSpec != null && packageSpec > 0 ? round2(portions * packageSpec) : null;
    const grossNeed =
      requiredQty != null ? round2(calcGrossNeedGrams(requiredQty, yieldRate ?? 0)) : null;
    const grossNeedJin = grossNeed != null ? round2(grossNeed / GRAMS_PER_JIN) : null;
    const l2Cat = net ? l2Map.get(net.l2Code) : undefined;
    const l1Cat = l2Cat?.parentCode ? l1Map.get(l2Cat.parentCode) : undefined;

    return {
      id: item.id,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      itemCode: net?.code ?? "",
      itemName: net?.name ?? "",
      l1Name: l1Cat?.name || "其他",
      l2Name: l2Cat?.name || net?.l2Code || "—",
      l2Code: net?.l2Code ?? "",
      packageSpec,
      unit: net?.unit ?? "g",
      yieldRate,
      portions,
      requiredQty,
      grossNeed,
      grossNeedJin,
    };
  });
}
