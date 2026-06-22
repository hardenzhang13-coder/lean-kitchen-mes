import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { success, badRequest, notFound, internalError } from "@/lib/api-response";

async function calculateUnitPrice(
  sourceIngredientId: number,
  yieldRate: number,
  providedUnitPrice?: number | null
): Promise<number | null> {
  if (providedUnitPrice != null && !Number.isNaN(providedUnitPrice)) {
    return providedUnitPrice;
  }

  if (!sourceIngredientId || !yieldRate) return null;

  const ingredient = await prisma.ingredient.findUnique({
    where: { id: sourceIngredientId },
    select: { latestRefPrice: true },
  });

  const price = ingredient?.latestRefPrice;
  if (price == null || Number(price) === 0 || yieldRate === 0) return null;

  return Number((Number(price) / (yieldRate / 100)).toFixed(2));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.netIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: { sourceIngredient: { select: { id: true, name: true } } },
    });
    if (!row) return notFound("净料不存在或已删除");
    return success(row);
  } catch {
    return internalError("获取净料失败");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      sourceIngredientId,
      spec,
      yieldRate,
      unitPrice,
      l2Code,
      autoCalculate,
    } = body;

    const existing = await prisma.netIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!existing) return notFound("净料不存在或已删除");

    if (!name?.trim() || !l2Code?.trim()) {
      return badRequest("名称和二级分类不能为空");
    }

    const l2Row = await prisma.ingredientCategoryL2.findUnique({
      where: { code: l2Code.trim() },
      select: { parentCode: true },
    });
    if (!l2Row) {
      return badRequest("二级分类不存在");
    }

    const isMinor = l2Row.parentCode === "MIN";

    let finalSourceIngredientId: number | null = null;
    let finalYieldRate: number | null = null;
    let finalUnitPrice: number;
    let finalUnit: string;

    if (isMinor) {
      if (sourceIngredientId) {
        finalSourceIngredientId = Number(sourceIngredientId);
      }
      finalYieldRate = yieldRate ? Number(yieldRate) : null;
      finalUnitPrice = unitPrice != null && !Number.isNaN(Number(unitPrice)) ? Number(unitPrice) : 0;
      finalUnit = "10g";
    } else {
      if (!sourceIngredientId) {
        return badRequest("非小料净料必须填写来源原料");
      }
      finalSourceIngredientId = Number(sourceIngredientId);

      const yieldRateNum = Number(yieldRate) || 0;
      if (yieldRateNum <= 0 || yieldRateNum > 100) {
        return badRequest("出成率必须在 1-100 之间");
      }
      finalYieldRate = yieldRateNum;

      const calculated = await calculateUnitPrice(
        finalSourceIngredientId,
        yieldRateNum,
        autoCalculate || unitPrice == null ? null : Number(unitPrice)
      );
      finalUnitPrice = calculated ?? 0;
      finalUnit = "500g";
    }

    const row = await prisma.netIngredient.update({
      where: { id: Number(id) },
      data: {
        name: name.trim(),
        sourceIngredientId: finalSourceIngredientId,
        spec: spec?.trim() || null,
        yieldRate: finalYieldRate,
        unitPrice: finalUnitPrice,
        unit: finalUnit,
        l2Code: l2Code.trim(),
        storage: "冷藏",
      },
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "NetIngredient",
      entityId: row.id,
      description: `更新净料: ${row.name || row.code}`,
    });

    return success(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "更新净料失败");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const existing = await prisma.netIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!existing) return notFound("净料不存在或已删除");

    const [netUsageCount, minorUsageCount] = await Promise.all([
      prisma.dishNetDetail.count({ where: { netIngId: Number(id) } }),
      prisma.dishMinorDetail.count({ where: { netIngId: Number(id) } }),
    ]);

    const totalUsage = netUsageCount + minorUsageCount;
    if (totalUsage > 0) {
      return badRequest(`该食材已被 ${totalUsage} 道菜品引用，无法删除`);
    }

    await prisma.netIngredient.update({
      where: { id: Number(id) },
      data: { deletedAt: new Date() },
    });

    await logOperation(req, {
      action: "DELETE",
      entity: "NetIngredient",
      entityId: Number(id),
      description: `删除净料: ${existing.name || existing.code}`,
    });

    return success({ success: true });
  } catch {
    return internalError("删除净料失败");
  }
}
