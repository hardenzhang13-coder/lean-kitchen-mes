import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { created, paginated, badRequest, internalError } from "@/lib/api-response";
import {
  createSauceIngredientSchema,
  sauceIngredientQuerySchema,
} from "@/lib/schemas/sauce-ingredient";
import { validateBody, validateQuery } from "@/lib/validate";

function generateSauceCode(lastCode: string | undefined) {
  const num = lastCode ? parseInt(lastCode.split("-")[1] || "0") + 1 : 1;
  return `SAU-${String(num).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(sauceIngredientQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { q, page, pageSize } = validation.data;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { code: { contains: term, mode: "insensitive" } },
      ];
    }

    const [rows, totalItems] = await Promise.all([
      prisma.sauceIngredient.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.sauceIngredient.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows, { page, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取酱料失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createSauceIngredientSchema, body);
    if (!validation.success) return validation.response;

    const { name, brand, spec, recipe, type, unitPrice } = validation.data;

    if (!name?.trim() || !type?.trim()) {
      return badRequest("名称和类型不能为空");
    }

    const last = await prisma.sauceIngredient.findFirst({ orderBy: { id: "desc" } });
    const code = generateSauceCode(last?.code);

    const row = await prisma.sauceIngredient.create({
      data: {
        code,
        name: name.trim(),
        brand: brand?.trim() || "",
        spec: spec?.trim() || null,
        recipe: recipe?.trim() || null,
        type: type.trim(),
        unitPrice: unitPrice ? Number(unitPrice) : 0,
        unit: "g",
      },
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "SauceIngredient",
      entityId: row.id,
      description: `创建酱料: ${row.name || row.code}`,
    });

    return created(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "创建酱料失败");
  }
}
