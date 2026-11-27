import type { Prisma, PrismaClient } from "@prisma/client";

import { nextCode } from "@/lib/shared/code-gen";
import { stripNamePackageSpec, syncNamePackageSpec } from "@/lib/shared/name-utils";
import { portionScaleFactor } from "@/lib/shared/portion-scale";
import { listPortionProfiles } from "@/lib/server/portion-profile-utils";
import type {
  DishScalePlan,
  DishScaleSpecInput,
  DishScaleSpecKind,
  DishScaleSpecPlan,
} from "@/lib/shared/dish-scale";

/** 转化预览/执行共用的源档案形状 */
export type DishScaleSource = Prisma.DishGetPayload<{
  include: {
    category: { select: { code: true } };
    netDetails: {
      include: {
        netIngredient: {
          include: {
            sourceIngredient: {
              select: { id: true; name: true; pricePerJin: true };
            };
          };
        };
      };
    };
    minorDetails: {
      include: {
        netIngredient: {
          include: {
            sourceIngredient: {
              select: { id: true; name: true; pricePerJin: true };
            };
          };
        };
      };
    };
    seasoningDetails: true;
    sauceDetails: true;
    processes: true;
  };
}>;

export const dishScaleSourceInclude = {
  category: { select: { code: true } },
  netDetails: {
    include: {
      netIngredient: {
        include: {
          sourceIngredient: {
            select: { id: true, name: true, pricePerJin: true },
          },
        },
      },
    },
  },
  minorDetails: {
    include: {
      netIngredient: {
        include: {
          sourceIngredient: {
            select: { id: true, name: true, pricePerJin: true },
          },
        },
      },
    },
  },
  seasoningDetails: true,
  sauceDetails: true,
  processes: true,
} satisfies Prisma.DishInclude;

export class DishScaleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DishScaleValidationError";
  }
}

type ScaleNetIngredient = NonNullable<
  DishScaleSource["netDetails"][number]["netIngredient"]
>;

type ExistingTarget = {
  id: number;
  code: string;
  name: string;
  packageSpec: number | null;
  portion: string | null;
};

function scaleSpecKey(kind: DishScaleSpecKind, sourceNetIngId: number): string {
  return `${kind}:${sourceNetIngId}`;
}

/**
 * 查找食材库中可复用的目标规格。复用口径（2026-11-27 收紧）：
 * 同来源原料 + 目标份量 + 同分类 + **同切法**（名称去末尾规格后一致）
 * + **封装规格恰好 = 源规格 × 倍率**。
 * 此前只按「来源原料 + 份量 + 分类」取 id 最小一行，同原料的不同切法、
 * 任意规格都会被静默复用，导致转化菜品的净料/小料用量错误；
 * 现口径下切法或规格不符的一律视为缺失，走可编辑的新建提案。
 */
async function findExistingTarget(
  db: Prisma.TransactionClient | PrismaClient,
  source: ScaleNetIngredient,
  targetPortion: string,
  expectedSpec: number
): Promise<ExistingTarget | null> {
  const where: Prisma.NetIngredientWhereInput = {
    deletedAt: null,
    portion: targetPortion,
    l2Code: source.l2Code,
    packageSpec: expectedSpec,
  };
  if (source.sourceIngredientId) {
    where.sourceIngredientId = source.sourceIngredientId;
  }
  // 历史数据可能没有来源原料：退化为同分类 + 同切法匹配（见下方过滤）
  const candidates = await db.netIngredient.findMany({
    where,
    orderBy: { id: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      packageSpec: true,
      portion: true,
    },
  });
  const sourceCut = stripNamePackageSpec(source.name);
  const row = candidates.find(
    (candidate) => stripNamePackageSpec(candidate.name) === sourceCut
  );
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    packageSpec: row.packageSpec != null ? Number(row.packageSpec) : null,
    portion: row.portion,
  };
}

async function buildSpecPlan(
  db: Prisma.TransactionClient | PrismaClient,
  kind: DishScaleSpecKind,
  sourceNetIngId: number,
  ingredient: ScaleNetIngredient,
  targetPortion: string,
  factor: number
): Promise<DishScaleSpecPlan> {
  // 期望规格先算出来：复用匹配与新建提案共用同一个「源规格 × 倍率」
  const packageSpec =
    ingredient.packageSpec != null
      ? Math.max(1, Math.round(Number(ingredient.packageSpec) * factor))
      : 1;
  const existing = await findExistingTarget(
    db,
    ingredient,
    targetPortion,
    packageSpec
  );

  return {
    kind,
    sourceNetIngId,
    sourceName: ingredient.name,
    sourceCode: ingredient.code,
    sourcePortion: ingredient.portion,
    sourcePackageSpec:
      ingredient.packageSpec != null ? Number(ingredient.packageSpec) : null,
    l2Code: ingredient.l2Code,
    sourceIngredientId: ingredient.sourceIngredientId,
    sourceIngredientName: ingredient.sourceIngredient?.name ?? null,
    sourceIngredientPricePerJin:
      ingredient.sourceIngredient?.pricePerJin != null
        ? Number(ingredient.sourceIngredient.pricePerJin)
        : null,
    packageMaterial: ingredient.packageMaterial ?? null,
    packageSize: ingredient.packageSize ?? null,
    storage: ingredient.storage ?? null,
    canCreate: Boolean(
      ingredient.sourceIngredientId && ingredient.sourceIngredient
    ),
    status: existing ? "existing" : "missing",
    existing: existing ?? undefined,
    proposal: {
      name: syncNamePackageSpec(ingredient.name, packageSpec),
      packageSpec,
      yieldRate:
        ingredient.yieldRate != null ? Number(ingredient.yieldRate) : 0,
      processingFeePerJin:
        ingredient.processingFeePerJin != null
          ? Number(ingredient.processingFeePerJin)
          : null,
      grossMarginRate:
        ingredient.grossMarginRate != null
          ? Number(ingredient.grossMarginRate)
          : null,
      portion: targetPortion,
    },
  };
}

/** 生成转化计划：逐条判断目标规格已存在还是需要新建 */
export async function buildDishScalePlan(
  db: Prisma.TransactionClient | PrismaClient,
  source: DishScaleSource,
  targetPortion: string
): Promise<DishScalePlan> {
  // 倍率新口径：目标档案行 multiplier ÷ 源档案行 multiplier（份量档案即真源）
  const profiles = await listPortionProfiles(db);
  const factor = portionScaleFactor(source.portion, targetPortion, profiles);
  if (factor == null || factor <= 0) {
    throw new DishScaleValidationError(
      `无法从源份量「${source.portion ?? "未知"}」推导转化倍率，请确认源与目标份量均已在设置-份量中维护`
    );
  }

  const net: DishScaleSpecPlan[] = [];
  const seenNetIds = new Set<number>();
  for (const detail of source.netDetails) {
    if (!detail.netIngredient) continue;
    // 同一净料可能在 BOM 中被重复引用，规格计划按净料去重
    if (seenNetIds.has(detail.netIngId)) continue;
    seenNetIds.add(detail.netIngId);
    net.push(
      await buildSpecPlan(
        db,
        "net",
        detail.netIngId,
        detail.netIngredient,
        targetPortion,
        factor
      )
    );
  }

  const minor: DishScaleSpecPlan[] = [];
  const seenMinorIds = new Set<number>();
  for (const detail of source.minorDetails) {
    if (!detail.netIngredient) continue;
    if (seenMinorIds.has(detail.netIngId)) continue;
    seenMinorIds.add(detail.netIngId);
    minor.push(
      await buildSpecPlan(
        db,
        "minor",
        detail.netIngId,
        detail.netIngredient,
        targetPortion,
        factor
      )
    );
  }

  return { factor, targetPortion, net, minor };
}

/**
 * 合并用户编辑与默认提案，校验缺失规格的可创建性。
 * 已存在的规格不进入结果，执行时直接复用。
 */
export function resolveScaleSpecInputs(
  plan: DishScalePlan,
  specs: DishScaleSpecInput[] | undefined
): Map<string, DishScaleSpecInput> {
  const provided = new Map(
    (specs ?? []).map((spec) => [
      scaleSpecKey(spec.kind, spec.sourceNetIngId),
      spec,
    ])
  );
  const missing = [...plan.net, ...plan.minor].filter(
    (spec) => spec.status === "missing"
  );

  const blocked = missing.filter((spec) => !spec.canCreate);
  if (blocked.length > 0) {
    const names = [...new Set(blocked.map((spec) => spec.sourceName))].join(
      "、"
    );
    throw new DishScaleValidationError(
      `以下食材缺少来源原料，不能自动创建目标规格：${names}`
    );
  }

  const result = new Map<string, DishScaleSpecInput>();
  for (const item of missing) {
    const key = scaleSpecKey(item.kind, item.sourceNetIngId);
    const input: DishScaleSpecInput =
      provided.get(key) ?? {
        kind: item.kind,
        sourceNetIngId: item.sourceNetIngId,
        name: item.proposal.name,
        packageSpec: item.proposal.packageSpec,
        yieldRate: item.proposal.yieldRate,
        processingFeePerJin: item.proposal.processingFeePerJin,
        grossMarginRate: item.proposal.grossMarginRate,
      };

    if (!input.name.trim()) {
      throw new DishScaleValidationError(
        `「${item.sourceName}」的规格名称不能为空`
      );
    }
    if (!Number.isInteger(input.packageSpec) || input.packageSpec < 1) {
      throw new DishScaleValidationError(
        `「${item.sourceName}」的封装规格必须为正整数`
      );
    }
    if (!(input.yieldRate > 0)) {
      throw new DishScaleValidationError(
        `「${item.sourceName}」的出成率必须大于 0`
      );
    }

    result.set(key, { ...input, name: input.name.trim() });
  }

  return result;
}

/** 生成净料/小料编码（PRD-0001），与新建净料接口同一口径 */
export async function generateNetIngredientCode(
  tx: Prisma.TransactionClient
): Promise<string> {
  const last = await tx.netIngredient.findFirst({
    where: { code: { startsWith: "PRD-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  return nextCode("PRD", last?.code);
}
