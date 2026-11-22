import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { error, internalError } from "@/lib/server/api-response";
import { productionPlanPreviewQuerySchema } from "@/lib/server/schemas/production-plan";
import { validateQuery } from "@/lib/server/validate";
import { buildProductionPlanData } from "@/lib/server/production-plan-utils";
import { ProductionPlanAssignmentError } from "@/lib/server/production-plan-assignment";
import { logger } from "@/lib/server/logger";

/**
 * 新建弹窗视图二预览：合并所选排程单的切配/采购基线，并附全量净菜库存 map（仅参考、不抵扣）。
 * GET /api/production-plans/preview?scheduleIds=1,2,3（scheduleIds 可空 = 纯手工切配计划）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(productionPlanPreviewQuerySchema, searchParams);
    if (!validation.success) return validation.response;
    const scheduleIds = [...new Set(validation.data.scheduleIds)];

    const data = await buildProductionPlanData(prisma, scheduleIds);
    const stockRows = await prisma.preppedStock.findMany({
      select: { sourceType: true, sourceId: true, currentPortions: true, currentQty: true },
    });
    const stockMap: Record<string, { portions: number; qtyG: number }> = {};
    const stockById: Record<string, { portions: number; qtyG: number }> = {};
    for (const s of stockRows) {
      const entry = { portions: Number(s.currentPortions), qtyG: Number(s.currentQty) };
      stockMap[s.sourceType + "-" + s.sourceId] = entry;
      stockById[String(s.sourceId)] = entry;
    }
    const cutting = data.cutting.map((c) => {
      const stock = stockMap[c.sourceType + "-" + c.sourceId];
      return {
        ...c,
        availablePortions: stock?.portions ?? 0,
        availableQtyG: stock?.qtyG ?? 0,
      };
    });
    return Response.json({ data: { cutting, purchase: data.purchase, stockMap, stockById } });
  } catch (err) {
    if (err instanceof ProductionPlanAssignmentError) {
      return error(err.message, err.status, err.status === 409 ? "CONFLICT" : "BAD_REQUEST");
    }
    logger.error({ err }, "GET /api/production-plans/preview failed");
    return internalError("生成预览失败");
  }
}
