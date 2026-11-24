import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success, badRequest, notFound, internalError, conflict } from "@/lib/server/api-response";
import { updateNetIngredientSchema } from "@/lib/server/schemas/net-ingredient";
import { validatePortionForUpdate } from "@/lib/server/portion-profile-utils";
import { validateBody } from "@/lib/server/validate";
import { calculateUnitPrice, serializeNetIngredient } from "@/lib/server/net-ingredient-utils";
import { syncBomAmountsForNetIngredient } from "@/lib/server/bom-package-sync";
import {
  BomSyncConflictError,
  recalcIncompleteDocumentsForNetIngredient,
} from "@/lib/server/incomplete-document-recalc";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.netIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: {
        sourceIngredient: {
          select: { id: true, name: true, pricePerJin: true },
        },
      },
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
    const netIngredientId = Number(id);
    const body = await req.json();
    const validation = validateBody(updateNetIngredientSchema, body);
    if (!validation.success) return validation.response;

    const {
      name,
      sourceIngredientId,
      packageSpec,
      packageMaterial,
      packageSize,
      processingFeePerJin,
      yieldRate,
      grossMarginRate,
      l2Code,
      portion,
    } = validation.data;

    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.netIngredient.findFirst({
          where: { id: netIngredientId, deletedAt: null },
        });
        if (!existing) throw new Error("净料不存在或已删除");

        // 份量须命中份量档案（portion_profiles）；允许保持现值不变
        if (typeof portion === "string") {
          const portionError = await validatePortionForUpdate(portion, existing.portion, tx);
          if (portionError) throw new Error(portionError);
        }

        if (!name?.trim() || !l2Code?.trim()) {
          throw new Error("名称和二级分类不能为空");
        }

        const l2Row = await tx.ingredientCategoryL2.findUnique({
          where: { code: l2Code.trim() },
          select: { parentCode: true },
        });
        if (!l2Row) throw new Error("二级分类不存在");

        const isMinor = l2Row.parentCode === "MIN";
        const existingL2 = existing.l2Code
          ? await tx.ingredientCategoryL2.findUnique({
              where: { code: existing.l2Code },
              select: { parentCode: true },
            })
          : null;
        const wasMinor = existingL2?.parentCode === "MIN";

        if (!sourceIngredientId) throw new Error("必须选择来源原料");

        const finalPackageSpec = packageSpec ?? existing.packageSpec;
        if (!finalPackageSpec || finalPackageSpec <= 0) {
          throw new Error("必须填写包装规格（g）");
        }
        const finalSourceIngredientId = Number(sourceIngredientId);

        const yieldRateNum = Number(yieldRate ?? existing.yieldRate);
        if (!yieldRateNum || yieldRateNum <= 0 || yieldRateNum > 500) {
          throw new Error("出成率必须在 0.01-500 之间（上浆/挂糊类可超过 100）");
        }

        const finalFee = processingFeePerJin ?? existing.processingFeePerJin ?? null;
        const finalMargin =
          grossMarginRate === undefined
            ? Number(existing.grossMarginRate ?? 0)
            : grossMarginRate ?? 0;

        const specChanged = finalPackageSpec !== existing.packageSpec;
        const yieldChanged = yieldRateNum !== Number(existing.yieldRate);
        const sourceChanged = finalSourceIngredientId !== existing.sourceIngredientId;
        const costChanged =
          specChanged ||
          yieldChanged ||
          sourceChanged ||
          Number(finalFee ?? 0) !== Number(existing.processingFeePerJin ?? 0) ||
          finalMargin !== Number(existing.grossMarginRate ?? 0);

        if (wasMinor !== isMinor) {
          const referenceCount =
            (await tx.dishNetDetail.count({ where: { netIngId: netIngredientId } })) +
            (await tx.dishMinorDetail.count({ where: { netIngId: netIngredientId } }));
          if (referenceCount > 0) {
            throw new BomSyncConflictError(
              "该净料/小料已被菜品 BOM 引用，不能跨小料/净料分类调整，请先在菜品中移除引用"
            );
          }
        }

        const calculated = await calculateUnitPrice(
          finalSourceIngredientId,
          yieldRateNum,
          tx
        );
        if (calculated == null) {
          throw new Error("来源原料缺少每斤单价，无法计算净料单价");
        }

        const row = await tx.netIngredient.update({
          where: { id: netIngredientId },
          data: {
            name: name.trim(),
            sourceIngredientId: finalSourceIngredientId,
            packageSpec: finalPackageSpec,
            packageMaterial:
              packageMaterial === undefined
                ? existing.packageMaterial
                : packageMaterial?.trim() || "密封袋",
            packageSize:
              packageSize === undefined
                ? existing.packageSize
                : packageSize?.trim() || "50cm×40cm",
            processingFeePerJin: finalFee,
            yieldRate: yieldRateNum,
            ...(portion !== undefined ? { portion } : {}),
            unitPrice: calculated,
            grossMarginRate: finalMargin,
            unit: "g",
            l2Code: l2Code.trim(),
            storage: "冷藏",
          },
          include: {
            sourceIngredient: {
              select: { id: true, name: true, pricePerJin: true },
            },
          },
        });

        let sync: Awaited<ReturnType<typeof syncBomAmountsForNetIngredient>> | null = null;
        let recalc: Awaited<
          ReturnType<typeof recalcIncompleteDocumentsForNetIngredient>
        > | null = null;

        if (costChanged) {
          sync = await syncBomAmountsForNetIngredient(tx, row.id, finalPackageSpec);
        }
        if (specChanged || yieldChanged || sourceChanged) {
          recalc = await recalcIncompleteDocumentsForNetIngredient(tx, row.id);
        }

        return {
          row,
          isMinor,
          oldPackageSpec: existing.packageSpec,
          sync,
          recalc,
        };
      },
      { timeout: 60_000, maxWait: 10_000 }
    );

    const { row, isMinor, oldPackageSpec, sync, recalc } = result;
    const syncParts: string[] = [];
    if (sync) {
      syncParts.push(
        `联动 BOM ${sync.netRows + sync.minorRows} 行 / ${sync.dishIds.length} 道菜品`
      );
    }
    if (recalc) {
      syncParts.push(
        `重建排程 ${recalc.scheduleIds.length} 张、生产计划 ${recalc.planIds.length} 张`
      );
    }

    await logOperation(req, {
      action: "UPDATE",
      entity: "NetIngredient",
      entityId: row.id,
      description:
        `更新${isMinor ? "小料" : "净料"}: ${row.name || row.code}` +
        `；封装规格 ${oldPackageSpec ?? "—"} → ${row.packageSpec}g` +
        (syncParts.length > 0 ? `；${syncParts.join("；")}` : ""),
    });

    return success({
      ...serializeNetIngredient(row),
      sync: {
        updatedBomRows: sync ? sync.netRows + sync.minorRows : 0,
        affectedDishCount: sync?.dishIds.length ?? 0,
        rebuiltScheduleIds: recalc?.scheduleIds ?? [],
        rebuiltPlanIds: recalc?.planIds ?? [],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof BomSyncConflictError) return conflict(message);
    if (message === "净料不存在或已删除") return notFound(message);
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
