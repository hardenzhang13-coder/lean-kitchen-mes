import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";

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

  try {
    if (type === "l1") {
      const row = await prisma.ingredientCategoryL1.update({
        where: { id: Number(id) },
        data: { code, name },
      });
      await logOperation(req, { action: "UPDATE", entity: "IngredientCategoryL1", entityId: row.id, description: `更新: ${row.name || row.code}` });
      return NextResponse.json(row);
    }
    if (type === "l2") {
      const row = await prisma.ingredientCategoryL2.update({
        where: { id: Number(id) },
        data: { code, name, parentCode, description: description || null },
      });
      await logOperation(req, { action: "UPDATE", entity: "IngredientCategoryL2", entityId: row.id, description: `更新: ${row.name || row.code}` });
      return NextResponse.json(row);
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  try {
    if (type === "l1") {
      const row = await prisma.ingredientCategoryL1.findUnique({ where: { id: Number(id) } });
      await prisma.ingredientCategoryL1.delete({ where: { id: Number(id) } });
      await logOperation(req, { action: "DELETE", entity: "IngredientCategoryL1", entityId: Number(id), description: `删除: ${row?.name || row?.code || id}` });
      return NextResponse.json({ success: true });
    }
    if (type === "l2") {
      const row = await prisma.ingredientCategoryL2.findUnique({ where: { id: Number(id) } });
      await prisma.ingredientCategoryL2.delete({ where: { id: Number(id) } });
      await logOperation(req, { action: "DELETE", entity: "IngredientCategoryL2", entityId: Number(id), description: `删除: ${row?.name || row?.code || id}` });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
