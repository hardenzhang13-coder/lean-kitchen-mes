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
import { updateStandardSeasoningSchema } from "@/lib/server/schemas/standard-seasoning";
import { validatePortionForUpdate } from "@/lib/server/portion-profile-utils";
import { validateBody } from "@/lib/server/validate";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";
import { logger } from "@/lib/server/logger";
import {
  calculateStandardSeasoningUnitPrice,
  serializeStandardSeasoning,
} from "@/lib/server/standard-seasoning-utils";
import { syncBomAmountsForStandardSeasoning } from "@/lib/server/seasoning-spec-sync";
import { recalcIncompleteDocumentsForStandardSeasoning } from "@/lib/server/seasoning-spec-recalc";
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
} as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.standardSeasoning.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: SOURCE_INCLUDE,
    });
    if (!row) return notFound("标准化调料不存在或已删除");

    return success(serializeStandardSeasoning(row));
  } catch (err) {
    logger.error({ err }, "GET /api/standard-seasonings/[id] failed");
    return internalError("获取标准化调料失败");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const specId = Number(id);
    const body = await req.json();
    const validation = validateBody(updateStandardSeasoningSchema, body);
    if (!validation.success) return validation.response;

    const {
      name,
      sourceIngredientId,
      packageSpec,
      portion,
      yieldRate,
      processingFeePerJin,
      grossMarginRate,
      storage,
    } = validation.data;

    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.standardSeasoning.findFirst({
          where: { id: specId, deletedAt: null },
        });
        if (!existing) throw new Error("标准化调料不存在或已删除");

        // 份量须命中份量档案（portion_profiles）；允许保持现值不变
        if (typeof portion === "string") {
          const portionError = await validatePortionForUpdate(portion, existing.portion, tx);
          if (portionError) throw new Error(portionError);
        }

        const finalName = (name ?? existing.name).trim();
        if (!finalName) throw new Error("名称不能为空");

        const finalSourceId = Number(sourceIngredientId ?? existing.sourceIngredientId);
        const seasoningL2Codes = await getSeasoningL2Codes();
        const source = await tx.ingredient.findFirst({
          where: { id: finalSourceId, deletedAt: null },
          select: { id: true, name: true, l2Code: true, pricePerJin: true },
        });
        if (!source) throw new Error("来源调料不存在或已删除");
        if (!seasoningL2Codes.includes(source.l2Code)) {
          throw new Error("来源调料不属于调味品体系，无法标准化");
        }

        const finalPackageSpec = packageSpec ?? existing.packageSpec;
        if (!finalPackageSpec || finalPackageSpec <= 0) {
          throw new Error("必须填写标准规格（g）");
        }

        const finalYieldRate = Number(yieldRate ?? existing.yieldRate);
        if (!finalYieldRate || finalYieldRate <= 0 || finalYieldRate > 500) {
          throw new Error("出成率必须在 0.01-500 之间");
        }

        const finalFee =
          processingFeePerJin === undefined
            ? existing.processingFeePerJin
            : processingFeePerJin;
        const finalMargin =
          grossMarginRate === undefined
            ? Number(existing.grossMarginRate ?? 0)
            : grossMarginRate ?? 0;

        const specChanged = finalPackageSpec !== existing.packageSpec;
        const yieldChanged = finalYieldRate !== Number(existing.yieldRate);
        const sourceChanged = finalSourceId !== existing.sourceIngredientId;
        const costChanged =
          specChanged ||
          yieldChanged ||
          sourceChanged ||
          Number(finalFee ?? 0) !== Number(existing.processingFeePerJin ?? 0) ||
          finalMargin !== Number(existing.grossMarginRate ?? 0);

        const calculated = await calculateStandardSeasoningUnitPrice(
          finalSourceId,
          finalYieldRate,
          tx
        );
        if (calculated == null) {
          throw new Error("来源调料缺少每斤单价，无法计算单价");
        }

        const row = await tx.standardSeasoning.update({
          where: { id: specId },
          data: {
            name: finalName,
            sourceIngredientId: finalSourceId,
            packageSpec: finalPackageSpec,
            ...(portion !== undefined ? { portion } : {}),
            yieldRate: finalYieldRate,
            unitPrice: calculated,
            processingFeePerJin: finalFee ?? null,
            grossMarginRate: finalMargin,
            // 二级分类始终继承来源调料
            l2Code: source.l2Code,
            ...(storage == null ? {} : { storage: storage.trim() || "常温" }),
          },
          include: SOURCE_INCLUDE,
        });

        let sync: Awaited<ReturnType<typeof syncBomAmountsForStandardSeasoning>> | null = null;
        let recalc: Awaited<
          ReturnType<typeof recalcIncompleteDocumentsForStandardSeasoning>
        > | null = null;

        if (costChanged) {
          const prices = serializeStandardSeasoning(row);
          sync = await syncBomAmountsForStandardSeasoning(
            tx,
            specId,
            finalPackageSpec,
            prices.outPricePerJin
          );
        }
        if (specChanged || yieldChanged || sourceChanged) {
          recalc = await recalcIncompleteDocumentsForStandardSeasoning(tx, specId);
        }

        return { row, oldPackageSpec: existing.packageSpec, sync, recalc };
      },
      { timeout: 60_000, maxWait: 10_000 }
    );

    const { row, oldPackageSpec, sync, recalc } = result;
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
      entity: "StandardSeasoning",
      entityId: row.id,
      description:
        `更新标准化调料: ${row.name || row.code}` +
        `；标准规格 ${oldPackageSpec ?? "—"}g → ${row.packageSpec}g` +
        (syncParts.length > 0 ? `；${syncParts.join("；")}` : ""),
    });

    return success({
      ...serializeStandardSeasoning(row),
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
    if (message === "标准化调料不存在或已删除") return notFound(message);
    logger.error({ err }, "PUT /api/standard-seasonings/[id] failed");
    return badRequest(message || "更新标准化调料失败");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const specId = Number(id);

    const existing = await prisma.standardSeasoning.findFirst({
      where: { id: specId, deletedAt: null },
    });
    if (!existing) return notFound("标准化调料不存在或已删除");

    const usageCount = await prisma.dishSeasoningDetail.count({
      where: { specId },
    });
    if (usageCount > 0) {
      return badRequest(`该标准化调料已被 ${usageCount} 道菜品引用，无法删除`);
    }

    await prisma.standardSeasoning.update({
      where: { id: specId },
      data: { deletedAt: new Date() },
    });

    await logOperation(req, {
      action: "DELETE",
      entity: "StandardSeasoning",
      entityId: specId,
      description: `删除标准化调料: ${existing.name || existing.code}`,
    });

    return success({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /api/standard-seasonings/[id] failed");
    return internalError("删除标准化调料失败");
  }
}
