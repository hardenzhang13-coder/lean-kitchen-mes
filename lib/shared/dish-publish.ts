/**
 * 菜品发布前的完整性校验（前后端共用纯函数，唯一真源）。
 *
 * 当前业务口径（2026-11 试运行反馈）：
 * - 基础信息：名称、荤素类型、售价必填；类别、菜系、做法、口味均可留空
 * - BOM：主料 ≥1；辅料、小料、调料、酱料不强制
 * - 毛利率不入库，由「售价 + 当前成本」实时派生，服务端无法独立校验
 */

export type DishPublishCandidate = {
  name?: string | null;
  meatType?: string | null;
  price?: number | string | { toString(): string } | null;
  netDetails?: ReadonlyArray<{ role?: string | null }> | null;
};

/** 返回首个缺失项提示；校验通过返回 null。 */
export function validateDishForPublish(
  dish: DishPublishCandidate
): string | null {
  if (!dish.name?.trim()) return "菜品名称不能为空";
  if (!dish.meatType) return "请选择荤素类型";
  if (dish.price == null || Number(dish.price) <= 0) {
    return "请填写售价（元/份），毛利率会根据成本自动计算";
  }
  if (!dish.netDetails?.some((detail) => detail.role === "main")) {
    return "主料不能为空";
  }
  return null;
}
