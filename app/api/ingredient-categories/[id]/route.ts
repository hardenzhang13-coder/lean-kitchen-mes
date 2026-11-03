import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";
import { updateIngredientCategorySchema } from "@/lib/server/schemas/ingredient-category";
import { validateBody } from "@/lib/server/validate";
import {
  countIngredientCategoryL1References,
  countIngredientCategoryL2References,
} from "@/lib/server/category-references";
import { getErrorMessage } from "@/lib/shared/error-utils";

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
    return success(row);
  }

  if (type === "l2") {
    const row = await prisma.ingredientCategoryL2.findUnique({
      where: { id: Number(id) },
      include: { parent: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return success(row);
  }

  // 默认先查 L1，再查 L2
  const l1 = await prisma.ingredientCategoryL1.findUnique({
    where: { id: Number(id) },
    include: { children: true },
  });
  if (l1) return success({ ...l1, _type: "l1" });

  const l2 = await prisma.ingredientCategoryL2.findUnique({
    where: { id: Number(id) },
    include: { parent: true },
  });
  if (l2) return success({ ...l2, _type: "l2" });

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(updateIngredientCategorySchema, body);
    if (!validation.success) return validation.response;

    const { type, code, name, parentCode, description, isActive } = validation.data;

    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "编号和名称不能为空" }, { status: 400 });
    }

    if (type === "l1") {
      const existing = await prisma.ingredientCategoryL1.findUnique({
        where: { id: Number(id) },
        include: { children: true },
      });
      if (!existing) return NextResponse.json({ error: "分类不存在" }, { status: 404 });

      const dup = await prisma.ingredientCategoryL1.findFirst({
        where: { code, NOT: { id: Number(id) } },
      });
      if (dup) {
        return NextResponse.json({ error: "编号已存在" }, { status: 400 });
      }

      // 编号改名：FK（L2.parentCode → L1.code）即时检查导致"先改父"或"先改子"都会悬空，
      // 采用事务内三步：新建新编号 L1 → 子级 parentCode 批量改挂 → 删除旧 L1。
      // 食材只引用 L2 编号，业务数据零影响；L1 的 id 会变（无外部按 id 引用）。
      if (code !== existing.code) {
        const [row] = await prisma.$transaction([
          prisma.ingredientCategoryL1.create({
            data: {
              code,
              name,
              description: description !== undefined ? description || null : existing.description,
              isActive: isActive !== undefined ? isActive : existing.isActive,
            },
          }),
          prisma.ingredientCategoryL2.updateMany({
            where: { parentCode: existing.code },
            data: { parentCode: code },
          }),
          prisma.ingredientCategoryL1.delete({ where: { id: existing.id } }),
        ]);
        await logOperation(req, { action: "UPDATE", entity: "IngredientCategoryL1", entityId: row.id, description: `更新: ${row.name || row.code}（编号 ${existing.code} → ${code}，级联 ${existing.children.length} 个二级分类）` });
        return success(row);
      }

      const row = await prisma.ingredientCategoryL1.update({
        where: { id: Number(id) },
        data: {
          code,
          name,
          ...(description !== undefined ? { description: description || null } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });
      await logOperation(req, { action: "UPDATE", entity: "IngredientCategoryL1", entityId: row.id, description: `更新: ${row.name || row.code}` });
      return success(row);
    }
    if (type === "l2") {
      const existing = await prisma.ingredientCategoryL2.findUnique({ where: { id: Number(id) } });
      if (!existing) return NextResponse.json({ error: "分类不存在" }, { status: 404 });

      const dup = await prisma.ingredientCategoryL2.findFirst({
        where: { code, NOT: { id: Number(id) } },
      });
      if (dup) {
        return NextResponse.json({ error: "编号已存在" }, { status: 400 });
      }

      const parent = await prisma.ingredientCategoryL1.findUnique({ where: { code: parentCode } });
      if (!parent) {
        return NextResponse.json({ error: "所属一级分类不存在" }, { status: 400 });
      }

      // 改编号会使食材/净料的 l2Code 引用悬空：被引用时禁止改编号，引导停用
      if (code !== existing.code) {
        const refs = await countIngredientCategoryL2References(existing.code);
        if (refs.total > 0) {
          return NextResponse.json(
            {
              error: `该分类已被 ${refs.total} 条业务数据引用，不可修改编号；如不再使用请停用`,
              references: refs.byEntity,
            },
            { status: 400 }
          );
        }
      }

      const row = await prisma.ingredientCategoryL2.update({
        where: { id: Number(id) },
        data: {
          code,
          name,
          parentCode,
          ...(description !== undefined ? { description: description || null } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });
      await logOperation(req, { action: "UPDATE", entity: "IngredientCategoryL2", entityId: row.id, description: `更新: ${row.name || row.code}` });
      return success(row);
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
      // 一级分类删除会级联删除其下二级分类（FK onDelete: Cascade），引用保护覆盖所有子级
      const refs = await countIngredientCategoryL1References(row.code);
      if (refs.total > 0) {
        return NextResponse.json(
          {
            error: `该分类已被 ${refs.total} 条业务数据引用，无法删除；如不再使用请停用`,
            references: refs.byEntity,
          },
          { status: 400 }
        );
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
      const refs = await countIngredientCategoryL2References(row.code);
      if (refs.total > 0) {
        return NextResponse.json(
          {
            error: `该分类已被 ${refs.total} 条业务数据引用，无法删除；如不再使用请停用`,
            references: refs.byEntity,
          },
          { status: 400 }
        );
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
