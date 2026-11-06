import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success, internalError, badRequest } from "@/lib/server/api-response";
import { reorderIngredientCategoriesSchema } from "@/lib/server/schemas/ingredient-category";
import { validateBody } from "@/lib/server/validate";
import { logger } from "@/lib/server/logger";

// 批量调整展示顺序：l1 为全局顺序；l2 为同一父级内的顺序（事务保证一致性）
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(reorderIngredientCategoriesSchema, body);
    if (!validation.success) return validation.response;

    const { type, ids } = validation.data;

    if (type === "l1") {
      const count = await prisma.ingredientCategoryL1.count({ where: { id: { in: ids } } });
      if (count !== ids.length) return badRequest("存在无效的分类 ID");

      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < ids.length; i++) {
          await tx.ingredientCategoryL1.update({ where: { id: ids[i] }, data: { sortOrder: i + 1 } });
        }
      });
      await logOperation(req, {
        action: "UPDATE",
        entity: "IngredientCategoryL1",
        description: `调整一级分类顺序（${ids.length} 项）`,
      });
      return success({ ok: true });
    }

    // l2 必须在同一父级内排序
    const rows = await prisma.ingredientCategoryL2.findMany({
      where: { id: { in: ids } },
      select: { id: true, parentCode: true },
    });
    if (rows.length !== ids.length) return badRequest("存在无效的分类 ID");
    if (new Set(rows.map((r) => r.parentCode)).size !== 1) {
      return badRequest("二级分类排序必须在同一父级内进行");
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.ingredientCategoryL2.update({ where: { id: ids[i] }, data: { sortOrder: i + 1 } });
      }
    });
    await logOperation(req, {
      action: "UPDATE",
      entity: "IngredientCategoryL2",
      description: `调整二级分类顺序（${ids.length} 项）`,
    });
    return success({ ok: true });
  } catch (err) {
    logger.error({ err }, "PUT /api/ingredient-categories/reorder failed");
    return internalError("调整顺序失败");
  }
}
