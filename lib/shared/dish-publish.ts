/**
 * 菜品发布前的完整性校验（前后端共用纯函数，唯一真源）。
 *
 * 当前业务口径（2026-11）：
 * - 基础信息：名称、类别、菜系、做法、口味、荤素必填
 * - BOM：主料 ≥1、辅料 ≥1；小料 / 调料 / 酱料不强制
 */

export type DishPublishCandidate = {
  name?: string | null;
  categoryId?: number | null;
  cuisine?: string | null;
  technique?: string | null;
  taste?: string | null;
  meatType?: string | null;
  netDetails?: ReadonlyArray<{ role?: string | null }> | null;
};

/** 返回首个缺失项提示；校验通过返回 null。 */
export function validateDishForPublish(
  dish: DishPublishCandidate
): string | null {
  if (!dish.name?.trim()) return "菜品名称不能为空";
  if (!dish.categoryId) return "请选择菜品类别";
  if (!dish.cuisine) return "请选择菜系";
  if (!dish.technique) return "请选择做法";
  if (!dish.taste) return "请选择口味";
  if (!dish.meatType) return "请选择荤素类型";
  if (!dish.netDetails?.some((detail) => detail.role === "main")) {
    return "主料不能为空";
  }
  if (!dish.netDetails?.some((detail) => detail.role === "support")) {
    return "辅料不能为空";
  }
  return null;
}
