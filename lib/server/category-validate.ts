import { prisma } from "@/lib/server/prisma";

// 分类归属校验（服务端）：业务表 l2Code/l3Code 为字符串弱引用，
// 写入前必须确认分类存在、domain 与业务域一致、且 l3 确为所选 l2 的子级。

export type CategoryDomain = "food" | "seasoning";

export interface CategoryAssignmentCheck {
  ok: boolean;
  error?: string;
}

/**
 * 校验 l2Code / l3Code 组合是否可写入业务表。
 * - l2Code 可空（调味品、净料的宽松口径由调用方自行把关必填性）
 * - l3Code 可空；非空时必须有所选 l2Code 且为其子级
 * - domain 不匹配时拒绝（食材分类与调味品分类相互独立）
 */
export async function validateCategoryAssignment(
  l2Code: string | null,
  l3Code: string | null,
  domain: CategoryDomain
): Promise<CategoryAssignmentCheck> {
  const domainLabel = domain === "seasoning" ? "调味品" : "食材";
  if (l3Code && !l2Code) {
    return { ok: false, error: "选择三级分类前请先选择二级分类" };
  }
  if (l2Code) {
    const l2 = await prisma.ingredientCategoryL2.findUnique({
      where: { code: l2Code },
      select: { domain: true },
    });
    if (!l2) return { ok: false, error: "二级分类不存在" };
    if (l2.domain !== domain) {
      return { ok: false, error: `该二级分类不属于${domainLabel}分类体系` };
    }
  }
  if (l3Code) {
    const l3 = await prisma.ingredientCategoryL3.findUnique({
      where: { code: l3Code },
      select: { parentCode: true, domain: true },
    });
    if (!l3) return { ok: false, error: "三级分类不存在" };
    if (l3.domain !== domain) {
      return { ok: false, error: `该三级分类不属于${domainLabel}分类体系` };
    }
    if (l3.parentCode !== l2Code) {
      return { ok: false, error: "三级分类不属于所选二级分类" };
    }
  }
  return { ok: true };
}
