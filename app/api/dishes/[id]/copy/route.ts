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
import { copyDishSchema } from "@/lib/server/schemas/dish";
import { validateBody } from "@/lib/server/validate";
import { getCurrentDishCostMap } from "@/lib/server/dish-costing";
import { createDishVariant } from "@/lib/server/dish-variant";
import { logger } from "@/lib/server/logger";

/** 默认复制名称：源名称 + 「-副本」；重名时依次追加 2、3… */
async function resolveCopyName(
  categoryId: number,
  portion: string,
  sourceName: string
): Promise<string> {
  const base = `${sourceName}-副本`;
  let candidate = base;
  let suffix = 1;
  for (;;) {
    const existing = await prisma.dish.findFirst({
      where: { categoryId, name: candidate, portion },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}

/**
 * 菜品复制：以现有档案为模板新建一条草稿档案。
 * 复制是新建动作，不带原记录 id；BOM、工序、售价原样保留，名称默认加「-副本」。
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

  const body = await req.json().catch(() => ({}));
  const validation = validateBody(copyDishSchema, body);
  if (!validation.success) return validation.response;
  const requestedName = validation.data.name?.trim();

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

  const newName =
    requestedName ??
    (await resolveCopyName(source.categoryId, source.portion, source.name));

  if (requestedName) {
    const duplicate = await prisma.dish.findFirst({
      where: {
        categoryId: source.categoryId,
        name: requestedName,
        portion: source.portion,
      },
      select: { code: true },
    });
    if (duplicate) {
      return conflict(`已存在同名同份量菜品档案：${duplicate.code}`);
    }
  }

  const sourceCost =
    (await getCurrentDishCostMap([source.id])).get(source.id) ?? 0;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const copied = await prisma.$transaction(
        async (tx) =>
          createDishVariant(tx, source, {
            name: newName,
            portion: source.portion,
            factor: 1,
            cost: sourceCost,
            operator,
          }),
        { isolationLevel: "Serializable" }
      );

      await logOperation(req, {
        action: "CREATE",
        entity: "Dish",
        entityId: copied.id,
        description: `复制菜品「${source.name}」(${source.code}) 为「${newName}」`,
      });

      return success(copied, 201);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        lastError = err;
        continue;
      }
      logger.error({ err }, "POST /api/dishes/[id]/copy failed");
      return internalError("复制菜品失败");
    }
  }

  logger.error({ err: lastError }, "生成菜品编码失败");
  return internalError(
    `生成菜品编码失败，请稍后重试: ${lastError?.message ?? "未知错误"}`
  );
}
