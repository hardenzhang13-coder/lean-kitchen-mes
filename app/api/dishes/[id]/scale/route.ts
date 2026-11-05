import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { success, badRequest, notFound, internalError } from "@/lib/server/api-response";
import { scaleDishSchema } from "@/lib/server/schemas/dish";
import { validateBody } from "@/lib/server/validate";
import { nextCode } from "@/lib/shared/code-gen";
import { portionScaleFactor } from "@/lib/shared/portion-scale";
import { logger } from "@/lib/server/logger";

/** 可被转化的源份量规格 */
const SOURCE_PORTION = "单人份";

async function generateDishCode(tx: Prisma.TransactionClient, categoryCode: string): Promise<string> {
  const prefix = `DSH-${categoryCode}`;
  const last = await tx.dish.findFirst({
    where: { code: { startsWith: `${prefix}-` } },
    orderBy: { code: "desc" },
  });
  return nextCode(prefix, last?.code);
}

/** 数值按倍率缩放并保留 4 位小数（与 BOM 成本精度一致） */
function scaleValue(value: Prisma.Decimal | number | null | undefined, factor: number): number | null {
  if (value == null) return null;
  return Number((Number(value) * factor).toFixed(4));
}

/**
 * 菜品转化：以「单人份」档案为源，按目标份量规格自动推导倍率
 * （如 单人份 → 一锅10份 = ×10），生成新规格独立草稿档案，不影响源档案。
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dishId = Number(id);
  if (!Number.isInteger(dishId) || dishId <= 0) {
    return badRequest("无效的菜品 ID");
  }

  const body = await req.json();
  const validation = validateBody(scaleDishSchema, body);
  if (!validation.success) return validation.response;
  const { portion } = validation.data;

  const source = await prisma.dish.findUnique({
    where: { id: dishId },
    include: {
      category: { select: { code: true } },
      netDetails: true,
      minorDetails: true,
      seasoningDetails: true,
      sauceDetails: true,
      processes: true,
    },
  });
  if (!source) return notFound("菜品不存在");
  if (source.portion !== SOURCE_PORTION) {
    return badRequest(`仅「${SOURCE_PORTION}」菜品档案可转化生成其它规格`);
  }
  if (portion === source.portion) {
    return badRequest("目标份量与源菜品份量相同，无需转化");
  }

  // 倍率由份量规格自动推导：目标份数 ÷ 源份数（单人份 = 1，一锅10份 = 10）
  const factor = portionScaleFactor(source.portion, portion);
  if (factor == null || factor <= 0) {
    return badRequest("无法从目标份量规格推导转化倍率");
  }

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const newDish = await prisma.$transaction(
        async (tx) => {
          const code = await generateDishCode(tx, source.category.code);
          return tx.dish.create({
            data: {
              code,
              name: source.name,
              intro: source.intro,
              categoryId: source.categoryId,
              cuisine: source.cuisine,
              technique: source.technique,
              taste: source.taste,
              portion,
              season: source.season,
              meatType: source.meatType,
              // 成本与售价按倍率同步缩放
              cost: scaleValue(source.cost, factor),
              price: scaleValue(source.price, factor),
              status: "draft",
              operator,
              netDetails: {
                create: source.netDetails.map((d) => ({
                  role: d.role,
                  netIngId: d.netIngId,
                  amountG: scaleValue(d.amountG, factor) ?? 0,
                  spec: d.spec,
                  cost: scaleValue(d.cost, factor),
                })),
              },
              minorDetails: {
                create: source.minorDetails.map((d) => ({
                  netIngId: d.netIngId,
                  amountG: scaleValue(d.amountG, factor) ?? 0,
                  brand: d.brand,
                  cost: scaleValue(d.cost, factor),
                })),
              },
              seasoningDetails: {
                create: source.seasoningDetails.map((d) => ({
                  type: d.type,
                  sourceId: d.sourceId,
                  amountG: scaleValue(d.amountG, factor) ?? 0,
                  brand: d.brand,
                  cost: scaleValue(d.cost, factor),
                })),
              },
              sauceDetails: {
                create: source.sauceDetails.map((d) => ({
                  sauceId: d.sauceId,
                  amountG: scaleValue(d.amountG, factor) ?? 0,
                  brand: d.brand,
                  cost: scaleValue(d.cost, factor),
                })),
              },
              // 加工工艺步骤原样复制（步骤文案不含计量缩放）
              processes: {
                create: source.processes.map((p) => ({
                  stage: p.stage,
                  stepNo: p.stepNo,
                  object: p.object,
                  action: p.action,
                  description: p.description,
                  tool: p.tool,
                  standard: p.standard,
                })),
              },
            },
          });
        },
        { isolationLevel: "Serializable" }
      );

      await logOperation(req, {
        action: "CREATE",
        entity: "Dish",
        entityId: newDish.id,
        description: `由「${source.portion}」菜品「${source.name}」(${source.code}) 转化生成「${portion}」档案（×${factor}）`,
      });

      return success(newDish, 201);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        lastError = err;
        continue;
      }
      logger.error({ err }, "POST /api/dishes/[id]/scale failed");
      return internalError("转化生成新规格档案失败");
    }
  }

  logger.error({ err: lastError }, "生成菜品编码失败");
  return internalError(`生成菜品编码失败，请稍后重试: ${lastError?.message ?? "未知错误"}`);
}
