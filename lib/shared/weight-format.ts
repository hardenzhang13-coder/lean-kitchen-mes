// 共享纯展示函数（前端/后端共用，无副作用，无 prisma/react 依赖）。
// 服务端排程业务算法 buildCuttingOrders/buildPurchasePlans 见 @/lib/server/schedule-utils。

/** 克 → 斤/g 展示：≥500g 显示斤，<500g 显示 g */
export function formatWeight(g: number): string {
  if (g >= 500) {
    return `${(g / 500).toFixed(2)}斤`;
  }
  return `${Math.round(g)}g`;
}

/** 纯数值：≥500g 返回斤数，否则返回克数 */
export function toWeightValue(g: number): { value: number; unit: string } {
  if (g >= 500) {
    return { value: Number((g / 500).toFixed(2)), unit: "斤" };
  }
  return { value: Math.round(g), unit: "g" };
}
