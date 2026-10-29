import { prisma } from "@/lib/server/prisma";
import { buildJinFactors } from "@/lib/shared/unit-conversion";

// 单位换算系数提供者（服务端）。
// 换算表由 units 字典表驱动：业务端只读取启用中且带 gramsPerUnit 的重量类单位。
// 纯函数 buildJinFactors 见 lib/shared/unit-conversion.ts。

/**
 * 查询单位字典，构建「单位名 → 每斤系数」换算表。
 * 供 calcJinPerPurchaseUnit / calcPricePerJin 等纯函数注入使用。
 */
export async function getJinFactors(): Promise<Record<string, number>> {
  const units = await prisma.unit.findMany({
    where: { isActive: true, gramsPerUnit: { not: null } },
    select: { name: true, gramsPerUnit: true },
  });
  return buildJinFactors(units);
}

/** 1 斤的克数（默认 500；若字典中「斤」被自定义则跟随字典） */
export async function getGramsPerJin(): Promise<number> {
  const jin = await prisma.unit.findUnique({
    where: { name: "斤" },
    select: { gramsPerUnit: true, isActive: true },
  });
  const grams = Number(jin?.gramsPerUnit);
  return jin?.isActive !== false && Number.isFinite(grams) && grams > 0
    ? grams
    : 500;
}
