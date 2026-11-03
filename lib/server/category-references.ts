import { prisma } from "@/lib/server/prisma";

// 分类字典引用检查（服务端）。
// 业务表中的分类编号是字符串引用（非外键，Dish.categoryId 除外），
// 删除/改名分类前必须确认无引用，否则会产生孤儿数据或使存量数据语义漂移。
// 模式与 lib/server/unit-references.ts 保持一致。

export interface CategoryReferenceResult {
  total: number;
  byEntity: Record<string, number>;
}

/** 统计某菜品类别被多少菜品引用 */
export async function countDishCategoryReferences(categoryId: number): Promise<CategoryReferenceResult> {
  const count = await prisma.dish.count({ where: { categoryId } });
  return { total: count, byEntity: count > 0 ? { 菜品: count } : {} };
}

/** 统计某食材二级分类编号被多少业务数据引用（仅未软删除的食材） */
export async function countIngredientCategoryL2References(l2Code: string): Promise<CategoryReferenceResult> {
  const [ingredientCount, netIngredientCount] = await Promise.all([
    prisma.ingredient.count({ where: { l2Code, deletedAt: null } }),
    prisma.netIngredient.count({ where: { l2Code, deletedAt: null } }),
  ]);
  const byEntity: Record<string, number> = {};
  let total = 0;
  if (ingredientCount > 0) byEntity["原料"] = ingredientCount;
  if (netIngredientCount > 0) byEntity["净料"] = netIngredientCount;
  total = ingredientCount + netIngredientCount;
  return { total, byEntity };
}

/** 统计某食材一级分类（含其下所有二级分类）被多少业务数据引用 */
export async function countIngredientCategoryL1References(l1Code: string): Promise<CategoryReferenceResult> {
  const children = await prisma.ingredientCategoryL2.findMany({
    where: { parentCode: l1Code },
    select: { code: true },
  });
  const results = await Promise.all(children.map((c) => countIngredientCategoryL2References(c.code)));
  const byEntity: Record<string, number> = {};
  let total = 0;
  for (const r of results) {
    for (const [entity, count] of Object.entries(r.byEntity)) {
      byEntity[entity] = (byEntity[entity] ?? 0) + count;
    }
    total += r.total;
  }
  return { total, byEntity };
}
