import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "l1") {
    const rows = await prisma.ingredientCategoryL1.findMany({
      orderBy: { id: "asc" },
      include: { children: { orderBy: { id: "asc" } } },
    });
    return NextResponse.json(rows);
  }

  if (type === "l2") {
    const rows = await prisma.ingredientCategoryL2.findMany({
      orderBy: { id: "asc" },
      include: { parent: true },
    });
    return NextResponse.json(rows);
  }

  // 默认返回树形结构
  const l1 = await prisma.ingredientCategoryL1.findMany({
    orderBy: { id: "asc" },
    include: { children: { orderBy: { id: "asc" } } },
  });
  return NextResponse.json(l1);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, code, name, parentCode, description } = body;

  if (!code?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "编号和名称不能为空" }, { status: 400 });
  }

  try {
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
