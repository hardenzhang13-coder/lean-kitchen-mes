import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { normalizeName } from "@/lib/duplicate-check";
import { getSeasoningL2Codes } from "@/lib/category-helpers";

const REQUIRED_FIELDS = ["name", "l2Code", "purchaseUnit", "stockUnit"];

function generateCode(prefix: string, seq: number) {
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rows: Array<{
    name?: string;
    alias?: string;
    l2Code?: string;
    purchaseSpec?: string;
    purchaseUnit?: string;
    stockUnit?: string;
    latestRefPrice?: string;
  }> = body.rows || [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "导入数据为空" }, { status: 400 });
  }

  const [l2Categories, seasoningL2Codes] = await Promise.all([
    prisma.ingredientCategoryL2.findMany({ select: { code: true } }),
    getSeasoningL2Codes(),
  ]);
  const l2Set = new Set(l2Categories.map((c) => c.code));

  const errors: { index: number; messages: string[] }[] = [];
  rows.forEach((row, idx) => {
    const msgs: string[] = [];
    for (const key of REQUIRED_FIELDS) {
      if (!row[key as keyof typeof row]?.toString().trim()) {
        msgs.push(`${key} 不能为空`);
      }
    }
    if (row.l2Code && !l2Set.has(row.l2Code)) {
      msgs.push("二级分类编码不存在");
    }
    if (msgs.length > 0) errors.push({ index: idx, messages: msgs });
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: "数据校验失败", errors }, { status: 400 });
  }

  const existingIngredients = await prisma.ingredient.findMany({
    where: { deletedAt: null },
    select: { name: true },
  });
  const existingNormalized = new Set(
    existingIngredients.map((r) => normalizeName(r.name))
  );

  const importNormalized = new Set<string>();
  rows.forEach((row, idx) => {
    const n = normalizeName(row.name || "");
    if (!n) return;
    const msgs: string[] = [];
    if (existingNormalized.has(n)) msgs.push("食材名称已存在");
    else if (importNormalized.has(n)) msgs.push("导入数据中存在重复名称");
    if (msgs.length > 0) errors.push({ index: idx, messages: msgs });
    else importNormalized.add(n);
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: "数据校验失败", errors }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const last = await tx.ingredient.findFirst({
        orderBy: { code: "desc" },
        select: { code: true },
      });
      let lastNum = last?.code
        ? parseInt(last.code.split("-")[1] || "0", 10)
        : 0;

      const data = rows.map((row) => {
        lastNum++;
        const prefix = seasoningL2Codes.includes(row.l2Code!) ? "SEA" : "ING";
        return {
          code: generateCode(prefix, lastNum),
          name: row.name!.trim(),
          alias: row.alias?.trim() || null,
          l2Code: row.l2Code!.trim(),
          purchaseSpec: row.purchaseSpec?.trim() || null,
          purchaseUnit: row.purchaseUnit!.trim(),
          stockUnit: row.stockUnit!.trim(),
          latestRefPrice: row.latestRefPrice?.trim()
            ? Number(row.latestRefPrice.trim())
            : null,
          season: "四季",
          storage: "常温",
        };
      });

      await tx.ingredient.createMany({ data });
    });

    await logOperation(req, {
      action: "BULK_CREATE",
      entity: "Ingredient",
      description: `批量导入食材 ${rows.length} 条`,
    });

    return NextResponse.json({ created: rows.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
