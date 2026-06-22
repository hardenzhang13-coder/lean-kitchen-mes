import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { success, created, badRequest, internalError } from "@/lib/api-response";

function generateSauceCode(lastCode: string | undefined) {
  const num = lastCode ? parseInt(lastCode.split("-")[1] || "0") + 1 : 1;
  return `SAU-${String(num).padStart(4, "0")}`;
}

const SAUCE_TYPES = ["自制", "外购"];

export async function GET() {
  try {
    const rows = await prisma.sauceIngredient.findMany({ orderBy: { id: "asc" } });
    return success(rows);
  } catch {
    return internalError("获取酱料失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, brand, spec, recipe, type, unitPrice } = body;

    if (!name?.trim() || !type?.trim()) {
      return badRequest("名称和类型不能为空");
    }
    if (!SAUCE_TYPES.includes(type)) {
      return badRequest("类型必须是“自制”或“外购”");
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
