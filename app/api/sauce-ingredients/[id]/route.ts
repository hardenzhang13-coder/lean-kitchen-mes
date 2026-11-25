import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { success, badRequest, notFound } from "@/lib/server/api-response";
import {
  computeCostPricePerJin,
  resolveRecipeLines,
  serializeSauce,
} from "@/lib/server/sauce-utils";

// 酱料机制已业务剥离（2026-11-25 调味品模块升级）：写入口关闭，仅保留 GET 供历史 BOM 展示。
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.sauceIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: { recipeDetails: true },
    });
    if (!row) return notFound("酱料不存在或已删除");

    // 解析配方行名称与行单价，供前端展示（不随行存储，价格实时计算）
    let resolvedLines: Awaited<ReturnType<typeof resolveRecipeLines>> = [];
    if (row.type === "自制" && row.recipeDetails.length > 0) {
      resolvedLines = await resolveRecipeLines(
        row.recipeDetails.map((l) => ({
          lineType: l.lineType as "net" | "seasoning",
          refId: l.refId,
          amountG: Number(l.amountG),
        }))
      );
    }
    const costPrice = computeCostPricePerJin({
      type: row.type,
      pricePerJin: row.pricePerJin,
      processingFeePerJin: row.processingFeePerJin,
      recipeLines: resolvedLines.map((l) => ({ cost: l.cost, amountG: l.amountG })),
    });

    return success(
      serializeSauce(
        {
          ...row,
          recipeDetails: row.recipeDetails.map((l) => {
            const resolved = resolvedLines.find((r) => r.lineType === l.lineType && r.refId === l.refId);
            return {
              ...l,
              name: resolved?.name ?? null,
              linePricePerJin: resolved?.linePricePerJin ?? null,
              cost: resolved?.cost ?? null,
            };
          }),
        },
        costPrice
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "获取酱料失败");
  }
}

