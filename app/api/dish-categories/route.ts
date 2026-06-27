import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { paginated, internalError } from "@/lib/api-response";
import { paginationQuerySchema } from "@/lib/schemas/common";
import { createDishCategorySchema } from "@/lib/schemas/dish-category";
import { validateBody, validateQuery } from "@/lib/validate";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { page, pageSize } = validation.data;
    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.dishCategory.findMany({
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.dishCategory.count(),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows, { page, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取菜品分类失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createDishCategorySchema, body);
    if (!validation.success) return validation.response;

    const { code, name, description } = validation.data;
    const row = await prisma.dishCategory.create({
      data: { code, name, description: description || null },
    });
    await logOperation(req, { action: "CREATE", entity: "DishCategory", entityId: row.id, description: `创建: ${row.name || row.code}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
