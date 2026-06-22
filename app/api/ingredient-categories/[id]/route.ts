import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "l1") {
    const row = await prisma.ingredientCategoryL1.findUnique({
      where: { id: Number(id) },
      include: { children: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  }

  if (type === "l2") {
    const row = await prisma.ingredientCategoryL2.findUnique({
      where: { id: Number(id) },
      include: { parent: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  }

  // 默认先查 L1，再查 L2
  const l1 = await prisma.ingredientCategoryL1.findUnique({
    where: { id: Number(id) },
    include: { children: true },
  });
  if (l1) return NextResponse.json({ ...l1, _type: "l1" });

  const l2 = await prisma.ingredientCategoryL2.findUnique({
    where: { id: Number(id) },
    include: { parent: true },
  });
  if (l2) return NextResponse.json({ ...l2, _type: "l2" });

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { type, code, name, parentCode, description } = body;

  if (!code?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "编号和名称不能为空" }, { status: 400 });
  }

  try {
    if (type === "l1") {
      const existing = await prisma.ingredientCategoryL1.findFirst({
        where: { code, NOT: { id: Number(id) } },
      });
      if (existing) {
        return NextResponse.json({ error: "编号已存在" }, { status: 400 });
      }
      const row = await prisma.ingredientCategoryL1.update({
        where: { id: Number(id) },
        data: { code, name },
      });
      await logOperation(req, { action: "UPDATE", entity: "IngredientCategoryL1", entityId: row.id, description: `更新: ${row.name || row.code}` });
      return NextResponse.json(row);
    }
    if (type === "l2") {
      const existing = await prisma.ingredientCategoryL2.findFirst({
        where: { code, NOT: { id: Number(id) } },
      });
      if (existing) {
        return NextResponse.json({ error: "编号已存在" }, { status: 400 });
      }
      const parent = await prisma.ingredientCategoryL1.findUnique({ where: { code: parentCode } });
      if (!parent) {
        return NextResponse.json({ error: "所属一级分类不存在" }, { status: 400 });
      }
      const row = await prisma.ingredientCategoryL2.update({
        where: { id: Number(id) },
        data: { code, name, parentCode, description: description || null },
      });
      await logOperation(req, { action: "UPDATE", entity: "IngredientCategoryL2", entityId: row.id, description: `更新: ${row.name || row.code}` });
      return NextResponse.json(row);
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  try {
    if (type === "l1") {
      const row = await prisma.ingredientCategoryL1.findUnique({
        where: { id: Number(id) },
        include: { children: true },
      });
      if (!row) {
        return NextResponse.json({ error: "分类不存在" }, { status: 404 });
      }
      const l2Codes = row.children.map((c) => c.code);
      if (l2Codes.length > 0) {
        const [ingredientCount, netIngredientCount] = await Promise.all([
          prisma.ingredient.count({ where: { l2Code: { in: l2Codes }, deletedAt: null } }),
          prisma.netIngredient.count({ where: { l2Code: { in: l2Codes }, deletedAt: null } }),
        ]);
        if (ingredientCount > 0 || netIngredientCount > 0) {
          return NextResponse.json({ error: "该分类已被食材引用，无法删除" }, { status: 400 });
        }
      }
      await prisma.ingredientCategoryL1.delete({ where: { id: Number(id) } });
      await logOperation(req, { action: "DELETE", entity: "IngredientCategoryL1", entityId: Number(id), description: `删除: ${row.name || row.code}` });
      return NextResponse.json({ success: true });
    }
    if (type === "l2") {
      const row = await prisma.ingredientCategoryL2.findUnique({ where: { id: Number(id) } });
      if (!row) {
        return NextResponse.json({ error: "分类不存在" }, { status: 404 });
      }
      const [ingredientCount, netIngredientCount] = await Promise.all([
        prisma.ingredient.count({ where: { l2Code: row.code, deletedAt: null } }),
        prisma.netIngredient.count({ where: { l2Code: row.code, deletedAt: null } }),
      ]);
      if (ingredientCount > 0 || netIngredientCount > 0) {
        return NextResponse.json({ error: "该分类已被食材引用，无法删除" }, { status: 400 });
      }
      await prisma.ingredientCategoryL2.delete({ where: { id: Number(id) } });
      await logOperation(req, { action: "DELETE", entity: "IngredientCategoryL2", entityId: Number(id), description: `删除: ${row.name || row.code}` });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
