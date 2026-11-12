import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { getMinorL2Codes } from "@/lib/server/category-helpers";
import { created, paginated, badRequest, internalError } from "@/lib/server/api-response";
import {
  createNetIngredientSchema,
  netIngredientQuerySchema,
} from "@/lib/server/schemas/net-ingredient";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { nextCode } from "@/lib/shared/code-gen";
import { calculateUnitPrice, serializeNetIngredient } from "@/lib/server/net-ingredient-utils";

async function getL2CodesByL1(l1Code: string): Promise<string[]> {
  const rows = await prisma.ingredientCategoryL2.findMany({
    where: { parentCode: l1Code },
    select: { code: true },
  });
  return rows.map((r) => r.code);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(netIngredientQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { sourceIngredientId, l1Code, l2Code, excludeMinor, q, page, pageSize } = validation.data;

    const where: Record<string, unknown> = { deletedAt: null };

    if (sourceIngredientId) {
      where.sourceIngredientId = sourceIngredientId;
    }

    if (l2Code) {
      where.l2Code = l2Code;
    } else if (l1Code) {
      const l2Codes = await getL2CodesByL1(l1Code);
      where.l2Code = { in: l2Codes };
    } else if (excludeMinor) {
      const minorL2Codes = await getMinorL2Codes();
      if (minorL2Codes.length > 0) {
        where.l2Code = { notIn: minorL2Codes };
      }
    }

    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { name: { contains: term } },
        { code: { contains: term } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.netIngredient.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
        include: { sourceIngredient: { select: { id: true, name: true } } },
      }),
      prisma.netIngredient.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows.map(serializeNetIngredient), { page, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取净料失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createNetIngredientSchema, body);
    if (!validation.success) return validation.response;

    const {
      name,
      sourceIngredientId,
      packageSpec,
      packageMaterial,
      packageSize,
      processingFeePerJin,
      yieldRate,
      unitPrice,
      grossMarginRate,
      l2Code,
      autoCalculate,
    } = validation.data;

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

    // 净料/小料统一口径：均由原料转化（来源原料 + 出成率 + 包装规格），成本价元/斤
    if (!sourceIngredientId) {
      return badRequest("必须选择来源原料");
    }
    // 包装规格（g）必填：标准规格价格的计算基础
    if (!packageSpec) {
      return badRequest("必须填写包装规格（g）");
    }
    const finalSourceIngredientId = Number(sourceIngredientId);

    const yieldRateNum = Number(yieldRate);
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

    const last = await prisma.netIngredient.findFirst({
      orderBy: { id: "desc" },
      select: { code: true },
    });
    const code = nextCode("PRD", last?.code ?? undefined);

    const row = await prisma.netIngredient.create({
      data: {
        code,
        name: name.trim(),
        sourceIngredientId: finalSourceIngredientId,
        packageSpec,
        packageMaterial: packageMaterial?.trim() || "密封袋",
        packageSize: packageSize?.trim() || "50cm×40cm",
        processingFeePerJin: processingFeePerJin ?? null,
        yieldRate: yieldRateNum,
        unitPrice: calculated,
        grossMarginRate: grossMarginRate ?? null,
        unit: "g",
        l2Code: l2Code.trim(),
        storage: "冷藏",
      },
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "NetIngredient",
      entityId: row.id,
      description: `创建${isMinor ? "小料" : "净料"}: ${row.name || row.code}`,
    });

    return created(serializeNetIngredient(row));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "创建净料失败");
  }
}
