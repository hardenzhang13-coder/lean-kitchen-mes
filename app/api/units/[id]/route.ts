import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";
import { updateUnitSchema } from "@/lib/server/schemas/unit";
import { validateBody } from "@/lib/server/validate";
import { countUnitReferences } from "@/lib/server/unit-references";
import { getErrorMessage } from "@/lib/shared/error-utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.unit.findUnique({ where: { id: Number(id) } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return success(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(updateUnitSchema, body);
    if (!validation.success) return validation.response;

    const existing = await prisma.unit.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "单位不存在" }, { status: 404 });

    const { name, category, gramsPerUnit, isActive } = validation.data;

    // 重量类必须带换算克数（仅当本次请求改动了相关字段时校验）
    const nextCategory = category ?? existing.category;
    const nextGrams = gramsPerUnit !== undefined ? gramsPerUnit : Number(existing.gramsPerUnit);
    if (nextCategory === "weight" && (!nextGrams || nextGrams <= 0)) {
      return NextResponse.json(
        { error: "重量类单位必须填写换算克数（1 单位合多少克）" },
        { status: 400 }
      );
    }

    // 改名会使存量业务数据语义漂移：被引用的单位禁止改名
    if (name && name !== existing.name) {
      const refs = await countUnitReferences(existing.name);
      if (refs.total > 0) {
        return NextResponse.json(
          {
            error: `该单位已被 ${refs.total} 条业务数据引用，不可改名；如不再使用请停用`,
            references: refs.byEntity,
          },
          { status: 400 }
        );
      }
    }

    const row = await prisma.unit.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(gramsPerUnit !== undefined ? { gramsPerUnit } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    await logOperation(req, { action: "UPDATE", entity: "Unit", entityId: row.id, description: `更新: ${row.name}` });
    return success(row);
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.unit.findUnique({ where: { id: Number(id) } });
    if (!row) return NextResponse.json({ error: "单位不存在" }, { status: 404 });

    // 被业务数据引用的单位禁止物理删除，引导停用
    const refs = await countUnitReferences(row.name);
    if (refs.total > 0) {
      return NextResponse.json(
        {
          error: `该单位已被 ${refs.total} 条业务数据引用，不可删除；如不再使用请停用`,
          references: refs.byEntity,
        },
        { status: 400 }
      );
    }

    await prisma.unit.delete({ where: { id: Number(id) } });
    await logOperation(req, { action: "DELETE", entity: "Unit", entityId: Number(id), description: `删除: ${row.name}` });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
