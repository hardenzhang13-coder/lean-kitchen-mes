import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import {
  success,
  badRequest,
  notFound,
  internalError,
  conflict,
} from "@/lib/server/api-response";
import { updateSeasoningProductSchema } from "@/lib/server/schemas/seasoning-product";
import { validatePortionForUpdate } from "@/lib/server/portion-profile-utils";
import { validateBody } from "@/lib/server/validate";
import { logger } from "@/lib/server/logger";
import type { SeasoningSourceMode } from "@/lib/shared/seasoning-product";
import {
  calculateSeasoningProductUnitPrice,
  serializeSeasoningProduct,
} from "@/lib/server/seasoning-product-utils";
import { syncBomCostsForSeasoningProduct } from "@/lib/server/seasoning-spec-sync";
import { recalcIncompleteDocumentsForSeasoningProduct } from "@/lib/server/seasoning-spec-recalc";
import { BomSyncConflictError } from "@/lib/server/incomplete-document-recalc";

const SOURCE_INCLUDE = {
  sourceIngredient: {
    select: {
      id: true,
      name: true,
      alias: true,
      purchaseSpec: true,
      pricePerJin: true,
    },
  },
  defaultSupplier: { select: { id: true, name: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.seasoningProduct.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: SOURCE_INCLUDE,
    });
    if (!row) return notFound("调料产物不存在或已删除");

    return success(serializeSeasoningProduct(row));
  } catch (err) {
    logger.error({ err }, "GET /api/seasoning-products/[id] failed");
    return internalError("获取调料产物失败");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const specId = Number(id);
    const body = await req.json();
    const validation = validateBody(updateSeasoningProductSchema, body);
    if (!validation.success) return validation.response;

    const {
      name,
      productType,
      sourceMode,
      sourceIngredientId,
      yieldRate,
      brand,
      purchaseSpec,
      purchaseUnit,
      latestRefPrice,
      pricePerJin,
      defaultSupplierId,
      packageSpec,
      portion,
      processingFeePerJin,
      grossMarginRate,
      storage,
    } = validation.data;

    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.seasoningProduct.findFirst({
          where: { id: specId, deletedAt: null },
        });
        if (!existing) throw new Error("调料产物不存在或已删除");

        // 份量须命中份量档案（portion_profiles）；允许保持现值不变
        if (typeof portion === "string") {
          const portionError = await validatePortionForUpdate(portion, existing.portion, tx);
          if (portionError) throw new Error(portionError);
        }

        const finalName = (name ?? existing.name).trim();
        if (!finalName) throw new Error("名称不能为空");

        const finalProductType = productType ?? existing.productType;
        const finalSourceMode = (sourceMode ?? existing.sourceMode) as SeasoningSourceMode;

        const finalSourceId =
          finalSourceMode === "transform"
            ? Number(sourceIngredientId ?? existing.sourceIngredientId)
            : null;
        const finalYieldRate =
          finalSourceMode === "transform"
            ? Number(yieldRate ?? existing.yieldRate)
            : null;
        const finalPricePerJin =
          finalSourceMode === "purchase"
            ? pricePerJin != null
              ? pricePerJin
              : existing.pricePerJin != null
                ? Number(existing.pricePerJin)
                : null
            : null;

        if (finalSourceMode === "transform") {
          if (!finalSourceId || !finalYieldRate) {
            throw new Error("转化口径必须选择来源调味品并填写出成率");
          }
          const source = await tx.ingredient.findFirst({
            where: { id: finalSourceId, deletedAt: null },
            select: { id: true },
          });
          if (!source) throw new Error("来源调味品不存在或已删除");
        } else if (finalPricePerJin == null || finalPricePerJin <= 0) {
          throw new Error("外购口径必须填写每斤单价");
        }

        const finalSupplierId =
          defaultSupplierId === undefined ? existing.defaultSupplierId : defaultSupplierId;
        if (finalSupplierId != null) {
          const supplier = await tx.supplier.findFirst({
            where: { id: finalSupplierId },
            select: { id: true },
          });
          if (!supplier) throw new Error("默认供应商不存在");
        }

        const finalPackageSpec = packageSpec ?? existing.packageSpec;
        if (!finalPackageSpec || finalPackageSpec <= 0) {
          throw new Error("必须填写封装规格（g）");
        }

        const finalFee =
          processingFeePerJin === undefined
            ? existing.processingFeePerJin
            : processingFeePerJin;
        const finalMargin =
          grossMarginRate === undefined
            ? Number(existing.grossMarginRate ?? 0)
            : grossMarginRate ?? 0;

        const sourceChanged = finalSourceId !== existing.sourceIngredientId;
        const modeChanged = finalSourceMode !== existing.sourceMode;
        const yieldChanged = finalYieldRate !== Number(existing.yieldRate);
        const priceChanged = finalPricePerJin !== Number(existing.pricePerJin);
        const costChanged =
          modeChanged ||
          yieldChanged ||
          priceChanged ||
          sourceChanged ||
          Number(finalFee ?? 0) !== Number(existing.processingFeePerJin ?? 0) ||
          finalMargin !== Number(existing.grossMarginRate ?? 0);

        const calculated = await calculateSeasoningProductUnitPrice(
          {
            sourceMode: finalSourceMode,
            sourceIngredientId: finalSourceId,
            yieldRate: finalYieldRate,
            pricePerJin: finalPricePerJin,
          },
          tx
        );
        if (calculated == null) {
          throw new Error(
            finalSourceMode === "transform"
              ? "来源调味品缺少每斤单价，无法派生单价"
              : "每斤单价无效，无法保存"
          );
        }

        // 口径切换时清空另一侧分支字段，避免残留历史值误导
        const row = await tx.seasoningProduct.update({
          where: { id: specId },
          data: {
            name: finalName,
            productType: finalProductType,
            sourceMode: finalSourceMode,
            sourceIngredientId: finalSourceMode === "transform" ? finalSourceId : null,
            yieldRate: finalSourceMode === "transform" ? finalYieldRate : null,
            brand:
              finalSourceMode === "purchase"
                ? (brand ?? existing.brand?.trim() ?? null) || null
                : null,
            purchaseSpec:
              finalSourceMode === "purchase"
                ? (purchaseSpec ?? existing.purchaseSpec?.trim() ?? null) || null
                : null,
            purchaseUnit:
              finalSourceMode === "purchase"
                ? (purchaseUnit ?? existing.purchaseUnit?.trim() ?? null) || null
                : null,
            latestRefPrice:
              finalSourceMode === "purchase"
                ? (latestRefPrice ?? (existing.latestRefPrice != null ? Number(existing.latestRefPrice) : null))
                : null,
            pricePerJin: finalSourceMode === "purchase" ? finalPricePerJin : null,
            defaultSupplierId: finalSupplierId ?? null,
            packageSpec: finalPackageSpec,
            ...(portion !== undefined ? { portion } : {}),
            unitPrice: calculated,
            processingFeePerJin: finalFee ?? null,
            grossMarginRate: finalMargin,
            ...(storage == null ? {} : { storage: storage.trim() || "常温" }),
          },
          include: SOURCE_INCLUDE,
        });

        let sync: Awaited<ReturnType<typeof syncBomCostsForSeasoningProduct>> | null = null;
        let recalc: Awaited<
          ReturnType<typeof recalcIncompleteDocumentsForSeasoningProduct>
        > | null = null;

        if (costChanged) {
          const prices = serializeSeasoningProduct(row);
          sync = await syncBomCostsForSeasoningProduct(tx, specId, prices.outPricePerJin);
        }
        if (modeChanged || yieldChanged || sourceChanged) {
          // 毛需求口径变化（出成率/来源/口径切换）才需重建采购计划；封装规格/份量/毛利率不影响
          recalc = await recalcIncompleteDocumentsForSeasoningProduct(tx, specId);
        }

        return { row, sync, recalc };
      },
      { timeout: 60_000, maxWait: 10_000 }
    );

    const { row, sync, recalc } = result;
    const syncParts: string[] = [];
    if (sync) {
      syncParts.push(`联动 BOM ${sync.rows} 行 / ${sync.dishIds.length} 道菜品`);
    }
    if (recalc) {
      syncParts.push(
        `重建排程 ${recalc.scheduleIds.length} 张、生产计划 ${recalc.planIds.length} 张`
      );
    }

    await logOperation(req, {
      action: "UPDATE",
      entity: "SeasoningProduct",
      entityId: row.id,
      description:
        `更新调料产物: ${row.name || row.code}` +
        (syncParts.length > 0 ? `；${syncParts.join("；")}` : ""),
    });

    return success({
      ...serializeSeasoningProduct(row),
      sync: {
        updatedBomRows: sync?.rows ?? 0,
        affectedDishCount: sync?.dishIds.length ?? 0,
        rebuiltScheduleIds: recalc?.scheduleIds ?? [],
        rebuiltPlanIds: recalc?.planIds ?? [],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof BomSyncConflictError) return conflict(message);
    if (message === "调料产物不存在或已删除") return notFound(message);
    logger.error({ err }, "PUT /api/seasoning-products/[id] failed");
    return badRequest(message || "更新调料产物失败");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const specId = Number(id);

    const existing = await prisma.seasoningProduct.findFirst({
      where: { id: specId, deletedAt: null },
    });
    if (!existing) return notFound("调料产物不存在或已删除");

    const usageCount = await prisma.dishSeasoningDetail.count({
      where: { specId },
    });
    if (usageCount > 0) {
      return badRequest(`该调料产物已被 ${usageCount} 道菜品引用，无法删除`);
    }

    await prisma.seasoningProduct.update({
      where: { id: specId },
      data: { deletedAt: new Date() },
    });

    await logOperation(req, {
      action: "DELETE",
      entity: "SeasoningProduct",
      entityId: specId,
      description: `删除调料产物: ${existing.name || existing.code}`,
    });

    return success({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /api/seasoning-products/[id] failed");
    return internalError("删除调料产物失败");
  }
}
