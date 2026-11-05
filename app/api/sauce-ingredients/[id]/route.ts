import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success, badRequest, notFound } from "@/lib/server/api-response";
import { createSauceIngredientSchema } from "@/lib/server/schemas/sauce-ingredient";
import { validateBody } from "@/lib/server/validate";
import { calcPricePerJin } from "@/lib/shared/spec-parser";
import { getJinFactors } from "@/lib/server/unit-factors";
import {
  computeCostPricePerJin,
  resolveRecipeLines,
  serializeSauce,
} from "@/lib/server/sauce-utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.sauceIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: { recipeDetails: true },
    });
    if (!row) return notFound("酱料不存在或已删除");

    // 解析配方行名称与行单价，供前端展示（不随行存储，价格实时计算）
    let resolvedLines: Awaited<ReturnType<typeof resolveRecipeLines>> = [];
    if (row.type === "自制" && row.recipeDetails.length > 0) {
      resolvedLines = await resolveRecipeLines(
        row.recipeDetails.map((l) => ({
          lineType: l.lineType as "net" | "seasoning",
          refId: l.refId,
          amountG: Number(l.amountG),
        }))
      );
    }
    const costPrice = computeCostPricePerJin({
      type: row.type,
      pricePerJin: row.pricePerJin,
      processingFeePerJin: row.processingFeePerJin,
      recipeLines: resolvedLines.map((l) => ({ cost: l.cost, amountG: l.amountG })),
    });

    return success(
      serializeSauce(
        {
          ...row,
          recipeDetails: row.recipeDetails.map((l) => {
            const resolved = resolvedLines.find((r) => r.lineType === l.lineType && r.refId === l.refId);
            return {
              ...l,
              name: resolved?.name ?? null,
              linePricePerJin: resolved?.linePricePerJin ?? null,
              cost: resolved?.cost ?? null,
            };
          }),
        },
        costPrice
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "获取酱料失败");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(createSauceIngredientSchema.partial(), body);
    if (!validation.success) return validation.response;

    const {
      name,
      type,
      brand,
      purchaseSpec,
      purchaseUnit,
      latestRefPrice,
      pricePerJin,
      grossMarginRate,
      processingFeePerJin,
      packageSpec,
      storage,
      remark,
      recipeLines,
    } = validation.data;

    const existing = await prisma.sauceIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!existing) return notFound("酱料不存在或已删除");

    const finalType = type ?? existing.type;
    if (!name?.trim() && name !== undefined) return badRequest("名称不能为空");

    // undefined = 未传（保留原值）；显式 null = 清空
    const pick = <T,>(next: T | undefined | null, prev: T | null): T | null =>
      next === undefined ? prev : next;

    // 外购：换算每斤单价（同 POST）
    let finalPricePerJin = pick(
      pricePerJin,
      existing.pricePerJin != null ? Number(existing.pricePerJin) : null
    );
    const refPriceChanged =
      latestRefPrice !== undefined || purchaseSpec !== undefined || purchaseUnit !== undefined;
    if (finalType === "外购" && pricePerJin === undefined && refPriceChanged) {
      const jinFactors = await getJinFactors();
      const refPrice = latestRefPrice ?? (existing.latestRefPrice != null ? Number(existing.latestRefPrice) : null);
      const spec = purchaseSpec !== undefined ? purchaseSpec : existing.purchaseSpec;
      const unit = purchaseUnit !== undefined ? purchaseUnit : existing.purchaseUnit;
      finalPricePerJin = calcPricePerJin(refPrice, spec, jinFactors, unit);
    }

    // 自制：传了 recipeLines 就整体替换并按当前价格体系重算行成本
    let resolvedLines: Awaited<ReturnType<typeof resolveRecipeLines>> | null = null;
    if (finalType === "自制" && recipeLines !== undefined) {
      if (recipeLines.length === 0) return badRequest("自制酱料必须至少包含一行配方明细");
      resolvedLines = await resolveRecipeLines(recipeLines);
    }

    const row = await prisma.sauceIngredient.update({
      where: { id: Number(id) },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        type: finalType,
        brand: brand === undefined ? existing.brand : brand?.trim() || null,
        purchaseSpec: pick(purchaseSpec?.trim() || null, existing.purchaseSpec),
        purchaseUnit: pick(purchaseUnit?.trim() || null, existing.purchaseUnit),
        latestRefPrice: pick(latestRefPrice ?? null, existing.latestRefPrice != null ? Number(existing.latestRefPrice) : null),
        pricePerJin: finalPricePerJin,
        grossMarginRate: pick(grossMarginRate ?? null, existing.grossMarginRate != null ? Number(existing.grossMarginRate) : null),
        processingFeePerJin: pick(
          processingFeePerJin ?? null,
          existing.processingFeePerJin != null ? Number(existing.processingFeePerJin) : null
        ),
        packageSpec: pick(packageSpec ?? null, existing.packageSpec),
        storage: storage?.trim() || existing.storage,
        remark: remark === undefined ? existing.remark : remark?.trim() || null,
        // 配方与流程整体替换（菜品 BOM 同款模式）
        ...(resolvedLines
          ? {
              recipeDetails: {
                deleteMany: {},
                create: resolvedLines.map((l) => ({
                  lineType: l.lineType,
                  refId: l.refId,
                  amountG: l.amountG,
                  cost: l.cost,
                })),
              },
            }
          : {}),
      },
      include: { recipeDetails: true },
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "SauceIngredient",
      entityId: row.id,
      description: `更新酱料: ${row.name || row.code}`,
    });

    const costPrice = computeCostPricePerJin({
      type: finalType,
      pricePerJin: row.pricePerJin,
      processingFeePerJin: row.processingFeePerJin,
      recipeLines: resolvedLines
        ? resolvedLines.map((l) => ({ cost: l.cost, amountG: l.amountG }))
        : finalType === "自制"
          ? row.recipeDetails.map((l) => ({ cost: l.cost != null ? Number(l.cost) : null, amountG: Number(l.amountG) }))
          : undefined,
    });
    return success(serializeSauce(row, costPrice));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "更新酱料失败");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const existing = await prisma.sauceIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!existing) return notFound("酱料不存在或已删除");

    // 引用保护：被菜品 BOM 引用的酱料不可删除
    const usageCount = await prisma.dishSauceDetail.count({ where: { sauceId: Number(id) } });
    if (usageCount > 0) {
      return badRequest(`该酱料已被 ${usageCount} 道菜品引用，无法删除`);
    }

    await prisma.sauceIngredient.update({
      where: { id: Number(id) },
      data: { deletedAt: new Date() },
    });

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
