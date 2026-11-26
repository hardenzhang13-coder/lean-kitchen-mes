import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { paginated, notFound, internalError } from "@/lib/server/api-response";
import { validateQuery } from "@/lib/server/validate";
import { paginationQuerySchema } from "@/lib/server/schemas/common";

/**
 * 调料产物（单品调料/复合调料/成品酱料）被哪些菜品引用。
 * 新口径 BOM 行通过 dish_seasoning_details.spec_id 指向产物。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const specId = Number(id);
    if (!Number.isInteger(specId) || specId <= 0) {
      return notFound("调料不存在");
    }

    const { searchParams } = new URL(req.url);
    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;
    const { page, pageSize } = validation.data;

    const exists = await prisma.seasoningProduct.findFirst({
      where: { id: specId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) return notFound("调料不存在或已删除");

    const where: Prisma.DishWhereInput = {
      seasoningDetails: { some: { specId } },
    };

    const [rows, totalItems] = await Promise.all([
      prisma.dish.findMany({
        where,
        orderBy: { code: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, code: true, name: true, portion: true },
      }),
      prisma.dish.count({ where }),
    ]);

    return paginated(rows, {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    });
  } catch {
    return internalError("获取使用概况失败");
  }
}
