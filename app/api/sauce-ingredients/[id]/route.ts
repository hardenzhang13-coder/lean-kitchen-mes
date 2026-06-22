import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { success, badRequest, notFound, internalError } from "@/lib/api-response";

const SAUCE_TYPES = ["自制", "外购"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.sauceIngredient.findUnique({ where: { id: Number(id) } });
    if (!row) return notFound("酱料不存在");
    return success(row);
  } catch {
    return internalError("获取酱料失败");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, brand, spec, recipe, type, unitPrice } = body;

    if (!name?.trim() || !type?.trim()) {
      return badRequest("名称和类型不能为空");
    }
    if (!SAUCE_TYPES.includes(type)) {
      return badRequest("类型必须是“自制”或“外购”");
    }

    const row = await prisma.sauceIngredient.update({
      where: { id: Number(id) },
      data: {
        name: name.trim(),
        brand: brand?.trim() || "",
        spec: spec?.trim() || null,
        recipe: recipe?.trim() || null,
        type: type.trim(),
        unitPrice: unitPrice ? Number(unitPrice) : 0,
        unit: "g",
      },
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "SauceIngredient",
      entityId: row.id,
      description: `更新酱料: ${row.name || row.code}`,
    });

    return success(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "更新酱料失败");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const existing = await prisma.sauceIngredient.findUnique({ where: { id: Number(id) } });
    if (!existing) return notFound("酱料不存在");

    await prisma.sauceIngredient.delete({ where: { id: Number(id) } });

    await logOperation(req, {
      action: "DELETE",
      entity: "SauceIngredient",
      entityId: Number(id),
      description: `删除酱料: ${existing.name || existing.code}`,
    });

    return success({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "删除酱料失败");
  }
}
