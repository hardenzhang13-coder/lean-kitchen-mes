import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  try {
    if (type === "l1") {
      const row = await prisma.ingredientCategoryL1.create({ data: { code, name } });
      return NextResponse.json(row, { status: 201 });
    }
    if (type === "l2") {
      const row = await prisma.ingredientCategoryL2.create({
        data: { code, name, parentCode, description: description || null },
      });
      return NextResponse.json(row, { status: 201 });
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
