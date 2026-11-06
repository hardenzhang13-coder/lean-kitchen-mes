import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { buildJinFactors, buildGramFactors } from "@/lib/shared/unit-conversion";

// 单位换算系数提供者（服务端）。
// 换算表由 units 字典表驱动：业务端只读取启用中且带 gramsPerUnit 的重量类单位。
// 纯函数 buildJinFactors / buildGramFactors 见 lib/shared/unit-conversion.ts。

/**
 * 查询单位字典，构建「单位名 → 每斤系数」换算表。
 * 供 calcJinPerPurchaseUnit / calcPricePerJin 等纯函数注入使用。
 */
export async function getJinFactors(
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<Record<string, number>> {
  const units = await db.unit.findMany({
    where: { isActive: true, gramsPerUnit: { not: null } },
    select: { name: true, gramsPerUnit: true },
  });
  return buildJinFactors(units);
}

/**
 * 查询单位字典，构建「单位名 → 1 单位合多少克」换算表。
 * 供 resolveStockInfo 等跨重量单位换算的纯函数注入使用。
 */
export async function getGramFactors(
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<Record<string, number>> {
  const units = await db.unit.findMany({
    where: { isActive: true, gramsPerUnit: { not: null } },
    select: { name: true, gramsPerUnit: true },
  });
  return buildGramFactors(units);
}

/**
 * 全部启用中重量类单位的名称集合。
 * 供「按重直采」判断（替代硬编码 purchaseUnit === "斤"）。
 */
export async function getWeightUnitNames(
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<Set<string>> {
  const units = await db.unit.findMany({
    where: { isActive: true, gramsPerUnit: { not: null } },
    select: { name: true },
  });
  return new Set(units.map((u) => u.name));
}

/** 1 斤的克数（默认 500；若字典中「斤」被自定义则跟随字典） */
export async function getGramsPerJin(
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<number> {
  const jin = await db.unit.findUnique({
    where: { name: "斤" },
    select: { gramsPerUnit: true, isActive: true },
  });
  const grams = Number(jin?.gramsPerUnit);
  return jin?.isActive !== false && Number.isFinite(grams) && grams > 0
    ? grams
    : 500;
}
