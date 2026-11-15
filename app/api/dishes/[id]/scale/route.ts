import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import {
  success,
  badRequest,
  notFound,
  conflict,
  internalError,
} from "@/lib/server/api-response";
import { scaleDishSchema } from "@/lib/server/schemas/dish";
import { validateBody } from "@/lib/server/validate";
import {
  buildPortionName,
  portionScaleFactor,
} from "@/lib/shared/portion-scale";
import { getCurrentDishCostMap } from "@/lib/server/dish-costing";
import { createDishVariant } from "@/lib/server/dish-variant";
import { logger } from "@/lib/server/logger";

/**
 * 菜品转化：以任一菜品档案为源，按目标份量规格自动推导倍率
 * （如 小碗菜 → 社区·3份 = ×6），生成独立的草稿档案，不影响源档案。
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dishId = Number(id);
  if (!Number.isInteger(dishId) || dishId <= 0) {
    return badRequest("无效的菜品 ID");
  }

  const body = await req.json();
  const validation = validateBody(scaleDishSchema, body);
  if (!validation.success) return validation.response;
  const { portion, name } = validation.data;

  const source = await prisma.dish.findUnique({
    where: { id: dishId },
    include: {
      category: { select: { code: true } },
      netDetails: true,
      minorDetails: true,
      seasoningDetails: true,
      sauceDetails: true,
      processes: true,
    },
  });
  if (!source) return notFound("菜品不存在");
  if (portion === source.portion) {
    return badRequest("目标份量与源菜品份量相同，无需转化");
  }

  // 倍率由份量规格自动推导：目标小碗菜等价份数 ÷ 源小碗菜等价份数
  const factor = portionScaleFactor(source.portion, portion);
  if (factor == null || factor <= 0) {
    return badRequest(
      `无法从源份量「${source.portion ?? "未知"}」推导转化倍率`
    );
  }

  const newName = name?.trim() || buildPortionName(source.name, portion);
  const duplicate = await prisma.dish.findFirst({
    where: { categoryId: source.categoryId, name: newName, portion },
    select: { code: true },
  });
  if (duplicate) {
    return conflict(`已存在同名同份量菜品档案：${duplicate.code}`);
  }

  // 成本按当前食材价格重算后再缩放，避免沿用 Dish.cost 历史快照
  const sourceCost =
    (await getCurrentDishCostMap([source.id])).get(source.id) ?? 0;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const newDish = await prisma.$transaction(
        async (tx) =>
          createDishVariant(tx, source, {
            name: newName,
            portion,
            factor,
            cost: sourceCost,
            operator,
          }),
        { isolationLevel: "Serializable" }
      );

      await logOperation(req, {
        action: "CREATE",
        entity: "Dish",
        entityId: newDish.id,
        description: `由「${source.portion}」菜品「${source.name}」(${source.code}) 转化生成「${portion}」档案（×${factor}）`,
      });

      return success(newDish, 201);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        lastError = err;
        continue;
      }
      logger.error({ err }, "POST /api/dishes/[id]/scale failed");
      return internalError("转化生成新规格档案失败");
    }
  }

  logger.error({ err: lastError }, "生成菜品编码失败");
  return internalError(`生成菜品编码失败，请稍后重试: ${lastError?.message ?? "未知错误"}`);
}
