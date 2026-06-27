import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getMinorL2Codes } from "@/lib/category-helpers";
import { created, paginated, badRequest, internalError } from "@/lib/api-response";
import {
  createNetIngredientSchema,
  netIngredientQuerySchema,
} from "@/lib/schemas/net-ingredient";
import { validateBody, validateQuery } from "@/lib/validate";

function generateNetCode(lastCode: string | undefined) {
  const num = lastCode ? parseInt(lastCode.split("-")[1] || "0") + 1 : 1;
  return `PRD-${String(num).padStart(4, "0")}`;
}

async function calculateUnitPrice(
  sourceIngredientId: number,
  yieldRate: number,
  providedUnitPrice?: number | null
): Promise<number | null> {
  if (providedUnitPrice != null && !Number.isNaN(providedUnitPrice)) {
    return providedUnitPrice;
  }

  if (!sourceIngredientId || !yieldRate) return null;

  const ingredient = await prisma.ingredient.findUnique({
    where: { id: sourceIngredientId },
    select: { latestRefPrice: true },
  });

  const price = ingredient?.latestRefPrice;
  if (price == null || Number(price) === 0 || yieldRate === 0) return null;

  return Number((Number(price) / (yieldRate / 100)).toFixed(2));
}

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
        { name: { contains: term, mode: "insensitive" } },
        { code: { contains: term, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.netIngredient.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
        include: { sourceIngredient: { select: { id: true, name: true } } },
      }),
      prisma.netIngredient.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows, { page, pageSize, totalItems, totalPages });
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
      spec,
      yieldRate,
      unitPrice,
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

    let finalSourceIngredientId: number | null = null;
    let finalYieldRate: number | null = null;
    let finalUnitPrice: number;
    let finalUnit: string;

    if (isMinor) {
      if (sourceIngredientId) {
        finalSourceIngredientId = Number(sourceIngredientId);
      }
      finalYieldRate = yieldRate ? Number(yieldRate) : null;
      finalUnitPrice = unitPrice != null && !Number.isNaN(Number(unitPrice)) ? Number(unitPrice) : 0;
      finalUnit = "10g";
    } else {
      if (!sourceIngredientId) {
        return badRequest("非小料净料必须填写来源原料");
      }
      finalSourceIngredientId = Number(sourceIngredientId);

      const yieldRateNum = Number(yieldRate) || 0;
      if (yieldRateNum <= 0 || yieldRateNum > 100) {
        return badRequest("出成率必须在 1-100 之间");
      }
      finalYieldRate = yieldRateNum;

      const calculated = await calculateUnitPrice(
        finalSourceIngredientId,
        yieldRateNum,
        autoCalculate || unitPrice == null ? null : Number(unitPrice)
      );
      finalUnitPrice = calculated ?? 0;
      finalUnit = "500g";
    }

    const last = await prisma.netIngredient.findFirst({
      orderBy: { id: "desc" },
      select: { code: true },
    });
    const code = generateNetCode(last?.code ?? undefined);

    const row = await prisma.netIngredient.create({
      data: {
        code,
        name: name.trim(),
        sourceIngredientId: finalSourceIngredientId,
        spec: spec?.trim() || null,
        yieldRate: finalYieldRate,
        unitPrice: finalUnitPrice,
        unit: finalUnit,
        l2Code: l2Code.trim(),
        storage: "冷藏",
      },
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "NetIngredient",
      entityId: row.id,
      description: `创建净料: ${row.name || row.code}`,
    });

    return created(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "创建净料失败");
  }
}
