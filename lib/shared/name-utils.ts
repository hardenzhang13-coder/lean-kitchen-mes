// 食材名称归一化与相似度匹配（共享纯函数）。
//
// 注意：normalizeName 与 normalizeNameForMatch 是两套「故意不同」的规则，不可合并——
// - normalizeName          用于重名查重（duplicate-check / 批量导入）：lowercase + 压缩空白
// - normalizeNameForMatch  用于 AI 识别的模糊匹配（recognize）：lowercase + 仅保留中文/字母/数字
// 二者语义不同，硬合并会改变匹配行为。

/** 重名查重用归一化：小写 + 压缩连续空白。 */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

/** 模糊匹配用归一化：小写 + 仅保留中文 / 字母 / 数字（去掉符号、空白、单位等）。 */
export function normalizeNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^一-龥a-z0-9]/g, "");
}

/**
 * 计算两个名称的相似度（0~1）。
 * 规则：完全相同=1；一方包含另一方=0.9；否则 0。
 * （用于 AI 采购识别匹配的宽松阈值判定）
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeNameForMatch(a);
  const nb = normalizeNameForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  return 0;
}

/**
 * 在候选食材中找与显示名最相似的一个（同时考虑名称与别名）。
 * 返回 { match, score }；无任何候选时 match 为 null。
 */
export function findBestIngredientMatch<T extends { name: string; alias?: string | null }>(
  displayName: string,
  ingredients: T[]
): { match: T | null; score: number } {
  let best: T | null = null;
  let bestScore = 0;
  for (const ing of ingredients) {
    const score = Math.max(
      nameSimilarity(displayName, ing.name),
      ing.alias ? nameSimilarity(displayName, ing.alias) : 0
    );
    if (score > bestScore) {
      bestScore = score;
      best = ing;
    }
  }
  return { match: best, score: bestScore };
}
