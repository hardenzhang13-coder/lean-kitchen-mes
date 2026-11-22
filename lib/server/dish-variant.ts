import { Prisma } from "@prisma/client";

import { nextCode } from "@/lib/shared/code-gen";
import { resolveNetBomAmountG } from "@/lib/shared/bom-amount";
import { getCurrentDishCostBreakdownMap } from "@/lib/server/dish-costing";

/** 复制/转化共用的源档案形状：主档 + 四层 BOM + 工序 + 分类编码 */
export type DishVariantSource = Prisma.DishGetPayload<{
  include: {
    category: { select: { code: true } };
    netDetails: true;
    minorDetails: true;
    seasoningDetails: true;
    sauceDetails: true;
    processes: true;
  };
}>;

export type DishVariantOptions = {
  name: string;
  portion: string;
  /** 缩放倍率：复制 = 1，转化 = 目标等价份数 ÷ 源等价份数 */
  factor: number;
  /** 源菜品当前成本（元/份），按倍率缩放后写入新档案 */
  cost: number | null;
  operator: string | null;
  /** 转化时把源 BOM 的净料/小料切换到目标份量规格 */
  netIngIdMap?: Map<number, number>;
  minorIngIdMap?: Map<number, number>;
};

/** 数值按倍率缩放并保留 4 位小数（与 BOM 成本精度一致） */
function scaleValue(
  value: Prisma.Decimal | number | null | undefined,
  factor: number
): number | null {
  if (value == null) return null;
  return Number((Number(value) * factor).toFixed(4));
}

async function generateDishCode(
  tx: Prisma.TransactionClient,
  categoryCode: string | null | undefined
): Promise<string> {
  // 未分类菜品使用 GEN 前缀，保持编号格式一致
  const prefix = `DSH-${categoryCode || "GEN"}`;
  const last = await tx.dish.findFirst({
    where: { code: { startsWith: `${prefix}-` } },
    orderBy: { code: "desc" },
  });
  return nextCode(prefix, last?.code);
}

/**
 * 由源菜品生成一条独立草稿档案：
 * - 复制：factor = 1、portion 与源相同、名称加「-副本」
 * - 转化：factor 由份量规格推导、portion 为目标份量
 * BOM 用量/成本与售价按倍率缩放，工序原样复制。
 */
export async function createDishVariant(
  tx: Prisma.TransactionClient,
  source: DishVariantSource,
  options: DishVariantOptions
) {
  const code = await generateDishCode(tx, source.category?.code);
  const { factor } = options;

  // 净料/小料的 BOM 用量必须等于目标档案的封装规格；先按目标 ID 取规格
  const targetNetIds = [
    ...new Set(
      source.netDetails.map(
        (detail) => options.netIngIdMap?.get(detail.netIngId) ?? detail.netIngId
      )
    ),
  ];
  const targetMinorIds = [
    ...new Set(
      source.minorDetails.map(
        (detail) => options.minorIngIdMap?.get(detail.netIngId) ?? detail.netIngId
      )
    ),
  ];
  const targetIngredients = await tx.netIngredient.findMany({
    where: { id: { in: [...targetNetIds, ...targetMinorIds] } },
    select: { id: true, name: true, packageSpec: true },
  });
  const packageSpecMap = new Map(
    targetIngredients.map((ingredient) => [ingredient.id, ingredient.packageSpec])
  );
  const requireSpec = (id: number): number => {
    const pkg = Number(packageSpecMap.get(id) ?? 0);
    if (!(pkg > 0)) {
      const ingredient = targetIngredients.find((item) => item.id === id);
      throw new Error(`${ingredient?.name ?? `净料 #${id}`} 缺少封装规格，无法生成菜品`);
    }
    return pkg;
  };

  const created = await tx.dish.create({
    data: {
      code,
      name: options.name,
      intro: source.intro,
      categoryId: source.categoryId,
      cuisine: source.cuisine,
      technique: source.technique,
      taste: source.taste,
      portion: options.portion,
      season: source.season,
      meatType: source.meatType,
      cost: scaleValue(options.cost, factor),
      price: scaleValue(source.price, factor),
      status: "draft",
      operator: options.operator,
      netDetails: {
        create: source.netDetails.map((detail) => {
          const netIngId =
            options.netIngIdMap?.get(detail.netIngId) ?? detail.netIngId;
          const packageSpec = requireSpec(netIngId);
          return {
            role: detail.role,
            netIngId,
            amountG: resolveNetBomAmountG(detail.amountG, packageSpec),
            spec: `${packageSpec}g`,
            cost: scaleValue(detail.cost, factor),
          };
        }),
      },
      minorDetails: {
        create: source.minorDetails.map((detail) => {
          const netIngId =
            options.minorIngIdMap?.get(detail.netIngId) ?? detail.netIngId;
          const packageSpec = requireSpec(netIngId);
          return {
            netIngId,
            amountG: resolveNetBomAmountG(detail.amountG, packageSpec),
            brand: detail.brand,
            cost: scaleValue(detail.cost, factor),
          };
        }),
      },
      seasoningDetails: {
        create: source.seasoningDetails.map((detail) => ({
          type: detail.type,
          sourceId: detail.sourceId,
          // 调料按克需求随份量倍率缩放
          specId: detail.specId,
          amountG: scaleValue(detail.amountG, factor) ?? 0,
          brand: detail.brand,
          cost: scaleValue(detail.cost, factor),
        })),
      },
      sauceDetails: {
        create: source.sauceDetails.map((detail) => ({
          sauceId: detail.sauceId,
          amountG: scaleValue(detail.amountG, factor) ?? 0,
          brand: detail.brand,
          cost: scaleValue(detail.cost, factor),
        })),
      },
      // 加工工艺步骤原样复制（步骤文案不含计量缩放）
      processes: {
        create: source.processes.map((process) => ({
          stage: process.stage,
          stepNo: process.stepNo,
          object: process.object,
          action: process.action,
          description: process.description,
          tool: process.tool,
          standard: process.standard,
        })),
      },
    },
  });

  // 目标规格下的当前成本以实时口径重算，避免沿用源成本缩放造成偏差
  const costMap = await getCurrentDishCostBreakdownMap([created.id], tx);
  const cost = costMap.get(created.id)?.total;
  if (cost != null) {
    await tx.dish.update({ where: { id: created.id }, data: { cost } });
  }

  return tx.dish.findUniqueOrThrow({ where: { id: created.id } });
}
