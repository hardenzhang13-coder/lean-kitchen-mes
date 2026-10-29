import { prisma } from "@/lib/server/prisma";
import { calcNetUnitPrice } from "@/lib/shared/spec-parser";

// 净料单价计算（服务端）。
// 合并了此前 app/api/net-ingredients/route.ts 与 [id]/route.ts 两处完全重复的
// calculateUnitPrice 实现，作为唯一真源。

/**
 * 计算净料单价。
 * - 若调用方已提供 unitPrice（providedUnitPrice），直接采用；
 * - 否则按「原料每斤单价 ÷ (出成率/100)」自动推算；
 * - 缺少原料每斤单价或出成率无效时返回 null（由用户手动填写）。
 */
export async function calculateUnitPrice(
  sourceIngredientId: number,
  yieldRate: number,
  providedUnitPrice?: number | null
): Promise<number | null> {
  if (providedUnitPrice != null && !Number.isNaN(providedUnitPrice)) {
    return providedUnitPrice;
  }

  if (!sourceIngredientId || !yieldRate) return null;

  const ingredient = await prisma.ingredient.findUnique({
    where: { id: sourceIngredientId },
    select: { pricePerJin: true },
  });

  return calcNetUnitPrice({
    pricePerJin: ingredient?.pricePerJin,
    yieldRate,
  });
}
