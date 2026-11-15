import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import {
  success,
  badRequest,
  notFound,
  conflict,
} from "@/lib/server/api-response";
import { dishStatusActionSchema } from "@/lib/server/schemas/dish";
import { validateBody } from "@/lib/server/validate";
import {
  DISH_STATUS_TRANSITIONS,
  canTransitionDishStatus,
  getDishStatusOption,
} from "@/lib/shared/dish-status";
import { validateDishForPublish } from "@/lib/shared/dish-publish";

/**
 * 菜品状态流转：发布 / 下架 / 停用 / 恢复发布。
 * 只有草稿可编辑；发布与恢复发布必须通过服务端完整性校验。
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
  const validation = validateBody(dishStatusActionSchema, body);
  if (!validation.success) return validation.response;
  const { action } = validation.data;
  const transition = DISH_STATUS_TRANSITIONS[action];

  const dish = await prisma.dish.findUnique({
    where: { id: dishId },
    select: {
      id: true,
      name: true,
      status: true,
      categoryId: true,
      cuisine: true,
      technique: true,
      taste: true,
      meatType: true,
      netDetails: { select: { role: true } },
    },
  });
  if (!dish) return notFound("菜品不存在");

  // 幂等：已经是目标状态时直接返回成功
  if (dish.status === transition.to) {
    return success({ id: dish.id, status: transition.to, unchanged: true });
  }

  if (!canTransitionDishStatus(dish.status, action)) {
    const currentLabel =
      getDishStatusOption(dish.status)?.label ?? dish.status ?? "未知";
    return conflict(
      `当前状态「${currentLabel}」不能执行「${transition.label}」操作`
    );
  }

  if (action === "publish" || action === "restore") {
    const publishError = validateDishForPublish(dish);
    if (publishError) return badRequest(publishError);
  }

  const updated = await prisma.dish.updateMany({
    where: { id: dishId, status: dish.status },
    data: { status: transition.to },
  });

  if (updated.count === 0) {
    const latest = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { status: true },
    });
    if (latest?.status === transition.to) {
      return success({ id: dishId, status: transition.to, unchanged: true });
    }
    return conflict("菜品状态已被其他操作变更，请刷新后重试");
  }

  await logOperation(req, {
    action: "UPDATE",
    entity: "Dish",
    entityId: dishId,
    description: `${transition.label}菜品: ${dish.name}`,
  });

  return success({ id: dishId, status: transition.to });
}
