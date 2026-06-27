import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { paginated, internalError } from "@/lib/api-response";
import { paginationQuerySchema } from "@/lib/schemas/common";
import { createIngredientCategorySchema } from "@/lib/schemas/ingredient-category";
import { validateBody, validateQuery } from "@/lib/validate";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { page, pageSize } = validation.data;
    const type = searchParams.get("type");
    const skip = (page - 1) * pageSize;

    if (type === "l1") {
      const [rows, totalItems] = await Promise.all([
        prisma.ingredientCategoryL1.findMany({
          orderBy: { id: "asc" },
          skip,
          take: pageSize,
        }),
        prisma.ingredientCategoryL1.count(),
      ]);
      const totalPages = Math.ceil(totalItems / pageSize);
      return paginated(rows, { page, pageSize, totalItems, totalPages });
    }

    if (type === "l2") {
      const [rows, totalItems] = await Promise.all([
        prisma.ingredientCategoryL2.findMany({
          orderBy: { id: "asc" },
          skip,
          take: pageSize,
          include: { parent: true },
        }),
        prisma.ingredientCategoryL2.count(),
      ]);
      const totalPages = Math.ceil(totalItems / pageSize);
      return paginated(rows, { page, pageSize, totalItems, totalPages });
    }

    // 默认返回树形结构，按一级分类分页
    const [l1, totalItems] = await Promise.all([
      prisma.ingredientCategoryL1.findMany({
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
        include: { children: { orderBy: { id: "asc" } } },
      }),
      prisma.ingredientCategoryL1.count(),
    ]);
    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(l1, { page, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取食材分类失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createIngredientCategorySchema, body);
    if (!validation.success) return validation.response;

    const { type, code, name, parentCode, description } = validation.data;

    if (type === "l1") {
      const existing = await prisma.ingredientCategoryL1.findUnique({ where: { code } });
      if (existing) {
        return NextResponse.json({ error: "编号已存在" }, { status: 400 });
      }
      const row = await prisma.ingredientCategoryL1.create({ data: { code, name } });
      await logOperation(req, { action: "CREATE", entity: "IngredientCategoryL1", entityId: row.id, description: `创建: ${row.name || row.code}` });
      return NextResponse.json(row, { status: 201 });
    }
    if (type === "l2") {
      if (!parentCode?.trim()) {
        return NextResponse.json({ error: "所属一级分类编码不能为空" }, { status: 400 });
      }
      const existing = await prisma.ingredientCategoryL2.findUnique({ where: { code } });
      if (existing) {
        return NextResponse.json({ error: "编号已存在" }, { status: 400 });
      }
      const parent = await prisma.ingredientCategoryL1.findUnique({ where: { code: parentCode } });
      if (!parent) {
        return NextResponse.json({ error: "所属一级分类不存在" }, { status: 400 });
      }
      const row = await prisma.ingredientCategoryL2.create({
        data: { code, name, parentCode, description: description || null },
      });
      await logOperation(req, { action: "CREATE", entity: "IngredientCategoryL2", entityId: row.id, description: `创建: ${row.name || row.code}` });
      return NextResponse.json(row, { status: 201 });
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
