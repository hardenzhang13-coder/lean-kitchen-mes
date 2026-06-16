import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";

const REQUIRED_FIELDS = ["name", "l2Code", "unit", "priceUnit", "storage"];
const VALID_SEASONS = ["四季", "春", "夏", "秋", "冬"];
const VALID_STORAGES = ["冷藏", "常温", "冷冻"];

function generateCode(seq: number) {
  return `ING-${String(seq).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rows: Array<{
    name?: string;
    alias?: string;
    l2Code?: string;
    unit?: string;
    priceUnit?: string;
    purchaseSpec?: string;
    season?: string;
    storage?: string;
  }> = body.rows || [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "导入数据为空" }, { status: 400 });
  }

  const l2Categories = await prisma.ingredientCategoryL2.findMany({
    select: { code: true },
  });
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
    if (row.season && !VALID_SEASONS.includes(row.season)) {
      msgs.push(`季节限定只能是 ${VALID_SEASONS.join("/")}`);
    }
    if (row.storage && !VALID_STORAGES.includes(row.storage)) {
      msgs.push(`储存方式只能是 ${VALID_STORAGES.join("/")}`);
    }
    if (msgs.length > 0) errors.push({ index: idx, messages: msgs });
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
        return {
          code: generateCode(lastNum),
          name: row.name!.trim(),
          alias: row.alias?.trim() || null,
          l2Code: row.l2Code!.trim(),
          unit: row.unit!.trim(),
          priceUnit: row.priceUnit!.trim(),
          purchaseSpec: row.purchaseSpec?.trim() || null,
          season: row.season?.trim() || "四季",
          storage: row.storage!.trim(),
        };
      });

      await tx.ingredient.createMany({ data });
    });

    await logOperation(req, {
      action: "BULK_CREATE",
      entity: "Ingredient",
      description: `批量导入原料 ${rows.length} 条`,
    });

    return NextResponse.json({ created: rows.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
