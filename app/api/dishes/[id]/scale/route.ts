import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import {
  success,
  badRequest,
  notFound,
  conflict,
  internalError,
} from "@/lib/server/api-response";
import { scaleDishSchema } from "@/lib/server/schemas/dish";
import { validateBody } from "@/lib/server/validate";
import { calcNetUnitPrice } from "@/lib/shared/spec-parser";
import { syncNamePackageSpec } from "@/lib/shared/name-utils";
import { getCurrentDishCostMap } from "@/lib/server/dish-costing";
import { createDishVariant } from "@/lib/server/dish-variant";
import {
  DishScaleValidationError,
  buildDishScalePlan,
  dishScaleSourceInclude,
  generateNetIngredientCode,
  resolveScaleSpecInputs,
} from "@/lib/server/dish-scale-plan";
import {
  validatePortionForCreate,
  validatePortionSourceForScale,
} from "@/lib/server/portion-profile-utils";
import { logger } from "@/lib/server/logger";

/**
 * 菜品转化：
 * 1. 同步把 BOM 引用的净料/小料切换到目标份量规格
 * 2. 食材库没有的目标规格，按用户确认的提案自动建档
 * 3. 生成独立草稿菜品，源档案不受影响
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dishId = Number(id);
  if (!Number.isInteger(dishId) || dishId <= 0) {
    return badRequest("无效的菜品 ID");
  }

  const body = await req.json();
  const validation = validateBody(scaleDishSchema, body);
  if (!validation.success) return validation.response;
  const { portion, name, specs: rawSpecs } = validation.data;
  const specs = rawSpecs?.map((spec) => ({
    ...spec,
    processingFeePerJin: spec.processingFeePerJin ?? null,
    grossMarginRate: spec.grossMarginRate ?? null,
  }));

  const source = await prisma.dish.findUnique({
    where: { id: dishId },
    include: dishScaleSourceInclude,
  });
  if (!source) return notFound("菜品不存在");
  // 转化仅开放给已发布菜品：草稿尚未定版、已停用不再投产，转化产物会失真
  if (source.status !== "published") {
    return badRequest("仅已发布菜品可转化，请先发布该菜品");
  }
  if (portion === source.portion) {
    return badRequest("目标份量与源菜品份量相同，无需转化");
  }


  // 转化方向锁定：仅当前基本单元（单人份）可作为源
  const sourcePortionError = await validatePortionSourceForScale(source.portion);
  if (sourcePortionError) return badRequest(sourcePortionError);

  // 目标份量须命中启用中的份量档案；倍率由档案行 multiplier 推导（新口径）
  const targetPortionError = await validatePortionForCreate(portion);
  if (targetPortionError) return badRequest(targetPortionError);

  // 转化后的菜品沿用源菜品名称，份量由 portion 字段区分
  const newName = name?.trim() || source.name;
  const duplicate = await prisma.dish.findFirst({
    where: { categoryId: source.categoryId, name: newName, portion },
    select: { code: true },
  });
  if (duplicate) {
    return conflict(`已存在同名同份量菜品档案：${duplicate.code}`);
  }

  // 成本按当前食材价格重算后再缩放，避免沿用 Dish.cost 历史快照
  const sourceCost =
    (await getCurrentDishCostMap([source.id])).get(source.id) ?? 0;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const plan = await buildDishScalePlan(tx, source, portion);
          const inputs = resolveScaleSpecInputs(plan, specs);

          const netIngIdMap = new Map<number, number>();
          const minorIngIdMap = new Map<number, number>();
          // 同一净料可能同时出现在主料与小料，或重复引用；首次解析后复用目标 id
          const resolvedBySourceId = new Map<number, number>();
          let createdSpecCount = 0;

          for (const item of [...plan.net, ...plan.minor]) {
            const idMap = item.kind === "net" ? netIngIdMap : minorIngIdMap;

            const cached = resolvedBySourceId.get(item.sourceNetIngId);
            if (cached != null) {
              idMap.set(item.sourceNetIngId, cached);
              continue;
            }

            if (item.existing) {
              idMap.set(item.sourceNetIngId, item.existing.id);
              resolvedBySourceId.set(item.sourceNetIngId, item.existing.id);
              continue;
            }

            const input = inputs.get(
              `${item.kind}:${item.sourceNetIngId}`
            );
            if (!input) {
              throw new DishScaleValidationError(
                `缺少「${item.sourceName}」的目标规格`
              );
            }
            if (!item.sourceIngredientId) {
              throw new DishScaleValidationError(
                `「${item.sourceName}」缺少来源原料，不能自动创建规格`
              );
            }
            const unitPrice = calcNetUnitPrice({
              pricePerJin: item.sourceIngredientPricePerJin,
              yieldRate: input.yieldRate,
            });
            if (unitPrice == null) {
              throw new DishScaleValidationError(
                `「${item.sourceName}」缺少来源原料价格，无法计算净料单价`
              );
            }

            const code = await generateNetIngredientCode(tx);
            const created = await tx.netIngredient.create({
              data: {
                code,
                name: syncNamePackageSpec(input.name, input.packageSpec),
                sourceIngredientId: item.sourceIngredientId,
                packageSpec: input.packageSpec,
                packageMaterial: item.packageMaterial || "密封袋",
                packageSize: item.packageSize || "50cm×40cm",
                processingFeePerJin: input.processingFeePerJin ?? null,
                yieldRate: input.yieldRate,
                unitPrice,
                grossMarginRate: input.grossMarginRate ?? 0,
                portion,
                unit: "g",
                l2Code: item.l2Code,
                storage: item.storage || "冷藏",
              },
              select: { id: true },
            });
            idMap.set(item.sourceNetIngId, created.id);
            resolvedBySourceId.set(item.sourceNetIngId, created.id);
            createdSpecCount += 1;
          }

          const dish = await createDishVariant(tx, source, {
            name: newName,
            portion,
            factor: plan.factor,
            cost: sourceCost,
            operator,
            netIngIdMap,
            minorIngIdMap,
          });

          return { dish, createdSpecCount, factor: plan.factor };
        },
        { isolationLevel: "Serializable" }
      );

      await logOperation(req, {
        action: "CREATE",
        entity: "Dish",
        entityId: result.dish.id,
        description: `由「${source.portion}」菜品「${source.name}」(${source.code}) 转化生成「${portion}」档案（×${result.factor}）${
          result.createdSpecCount > 0
            ? `，新建 ${result.createdSpecCount} 个净料/小料规格`
            : ""
        }`,
      });

      return success(result.dish, 201);
    } catch (err) {
      if (err instanceof DishScaleValidationError) {
        return badRequest(err.message);
      }
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        lastError = err;
        continue;
      }
      logger.error({ err }, "POST /api/dishes/[id]/scale failed");
      return internalError("转化生成新规格档案失败");
    }
  }

  logger.error({ err: lastError }, "生成菜品编码失败");
  return internalError(
    `生成菜品编码失败，请稍后重试: ${lastError?.message ?? "未知错误"}`
  );
}
