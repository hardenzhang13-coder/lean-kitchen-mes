import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { success, badRequest, notFound, internalError } from "@/lib/server/api-response";
import { scalePreviewSchema } from "@/lib/server/schemas/dish";
import { validateBody } from "@/lib/server/validate";
import {
  DishScaleValidationError,
  buildDishScalePlan,
  dishScaleSourceInclude,
} from "@/lib/server/dish-scale-plan";
import { logger } from "@/lib/server/logger";

/**
 * 菜品转化预览：选择目标份量后，返回净料/小料的规格匹配计划。
 * 已存在的目标规格直接复用；缺失的返回可编辑提案，由前端确认后执行转化。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dishId = Number(id);
  if (!Number.isInteger(dishId) || dishId <= 0) {
    return badRequest("无效的菜品 ID");
  }

  const body = await req.json().catch(() => null);
  const validation = validateBody(scalePreviewSchema, body);
  if (!validation.success) return validation.response;
  const { portion } = validation.data;

  try {
    const source = await prisma.dish.findUnique({
      where: { id: dishId },
      include: dishScaleSourceInclude,
    });
    if (!source) return notFound("菜品不存在");
    if (portion === source.portion) {
      return badRequest("目标份量与源菜品份量相同，无需转化");
    }

    const plan = await buildDishScalePlan(prisma, source, portion);
    return success(plan);
  } catch (err) {
    if (err instanceof DishScaleValidationError) {
      return badRequest(err.message);
    }
    logger.error({ err }, "POST /api/dishes/[id]/scale/preview failed");
    return internalError("获取转化预览失败");
  }
}
