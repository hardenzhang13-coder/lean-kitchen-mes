// 共享纯展示函数（前端/后端共用，无副作用，无 prisma/react 依赖）。
// 服务端排程业务算法 buildCuttingOrders/buildPurchasePlans 见 @/lib/server/schedule-utils。
// 斤↔克基准默认 500（GRAMS_PER_JIN），调用方可传入单位字典中「斤」的 gramsPerUnit 覆盖。

import { GRAMS_PER_JIN } from "./unit-conversion";

/** 克 → 斤/g 展示：≥1斤 显示斤，不足显示 g */
export function formatWeight(g: number, gramsPerJin: number = GRAMS_PER_JIN): string {
  if (g >= gramsPerJin) {
    return `${(g / gramsPerJin).toFixed(2)}斤`;
  }
  return `${Math.round(g)}g`;
}

/** 纯数值：≥1斤 返回斤数，否则返回克数 */
export function toWeightValue(
  g: number,
  gramsPerJin: number = GRAMS_PER_JIN
): { value: number; unit: string } {
  if (g >= gramsPerJin) {
    return { value: Number((g / gramsPerJin).toFixed(2)), unit: "斤" };
  }
  return { value: Math.round(g), unit: "g" };
}
