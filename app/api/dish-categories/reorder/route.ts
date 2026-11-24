import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success, internalError, badRequest } from "@/lib/server/api-response";
import { reorderCategoriesSchema } from "@/lib/server/schemas/dish-category";
import { validateBody } from "@/lib/server/validate";
import { logger } from "@/lib/server/logger";

// 批量调整展示顺序：按传入的 id 数组顺序依次写入 sortOrder（事务保证一致性）
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(reorderCategoriesSchema, body);
    if (!validation.success) return validation.response;

    const { ids } = validation.data;

    const [count, total] = await Promise.all([
      prisma.dishCategory.count({ where: { id: { in: ids } } }),
      prisma.dishCategory.count(),
    ]);
    if (count !== ids.length) return badRequest("存在无效的类别 ID");
    // 排序值按序写入，id 列表必须覆盖全部类别，否则会出现重复顺序值
    if (total !== ids.length) return badRequest("类别列表已变化，请刷新后重试");

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.dishCategory.update({ where: { id: ids[i] }, data: { sortOrder: i + 1 } });
      }
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "DishCategory",
      description: `调整菜品类别顺序（${ids.length} 项）`,
    });

    return success({ ok: true });
  } catch (err) {
    logger.error({ err }, "PUT /api/dish-categories/reorder failed");
    return internalError("调整顺序失败");
  }
}
