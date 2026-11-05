import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success, badRequest, notFound, internalError } from "@/lib/server/api-response";
import { createNetIngredientSchema } from "@/lib/server/schemas/net-ingredient";
import { validateBody } from "@/lib/server/validate";
import { calculateUnitPrice, serializeNetIngredient } from "@/lib/server/net-ingredient-utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.netIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: { sourceIngredient: { select: { id: true, name: true } } },
    });
    if (!row) return notFound("净料不存在或已删除");
    return success(serializeNetIngredient(row));
  } catch {
    return internalError("获取净料失败");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(createNetIngredientSchema.partial(), body);
    if (!validation.success) return validation.response;

    const {
      name,
      sourceIngredientId,
      packageSpec,
      processingFeePerJin,
      yieldRate,
      unitPrice,
      grossMarginRate,
      l2Code,
      autoCalculate,
    } = validation.data;

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

    // 净料/小料统一口径（同 POST）：来源原料 + 出成率 + 封装规格必填，成本价元/斤
    if (!sourceIngredientId) {
      return badRequest("必须选择来源原料");
    }
    // 封装规格（g）必填：编辑存量数据时补填
    const finalPackageSpec = packageSpec ?? existing.packageSpec;
    if (!finalPackageSpec) {
      return badRequest("必须填写封装规格（g）");
    }
    const finalSourceIngredientId = Number(sourceIngredientId);

    const yieldRateNum = Number(yieldRate ?? existing.yieldRate);
    if (!yieldRateNum || yieldRateNum <= 0 || yieldRateNum > 500) {
      return badRequest("出成率必须在 0.01-500 之间（上浆/挂糊类可超过 100）");
    }

    const calculated = await calculateUnitPrice(
      finalSourceIngredientId,
      yieldRateNum,
      autoCalculate || unitPrice == null ? null : Number(unitPrice)
    );
    if (calculated == null) {
      return badRequest("来源原料缺少每斤单价，请先在原料中填写价格，或手动填写净料单价");
    }

    const row = await prisma.netIngredient.update({
      where: { id: Number(id) },
      data: {
        name: name.trim(),
        sourceIngredientId: finalSourceIngredientId,
        packageSpec: finalPackageSpec,
        processingFeePerJin: processingFeePerJin ?? existing.processingFeePerJin ?? null,
        yieldRate: yieldRateNum,
        unitPrice: calculated,
        // undefined = 未传该字段（保持原值）；显式 null = 用户清空毛利率
        grossMarginRate: grossMarginRate === undefined ? (existing.grossMarginRate ?? null) : grossMarginRate,
        unit: "g",
        l2Code: l2Code.trim(),
        storage: "冷藏",
      },
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "NetIngredient",
      entityId: row.id,
      description: `更新${isMinor ? "小料" : "净料"}: ${row.name || row.code}`,
    });

    return success(serializeNetIngredient(row));
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
