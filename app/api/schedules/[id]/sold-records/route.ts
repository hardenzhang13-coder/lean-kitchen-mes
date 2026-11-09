import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { success, notFound, badRequest, internalError } from "@/lib/server/api-response";
import { createSoldRecordsSchema } from "@/lib/server/schemas/sold-record";
import { validateBody } from "@/lib/server/validate";
import { resolveUsernameToName } from "@/lib/server/user-resolve";
import { logger } from "@/lib/server/logger";

/**
 * 批量写入销售回录（手动/CSV 导入共用）。
 * - soldQty 为 null 表示清除该行回录（回到未回录态）
 * - 全部行在同一个事务中更新；每行记录最后回录时间与操作人
 * - 已完成/进行中的排程均可回录与补录（便于补账）
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);

  const body = await req.json();
  const validation = validateBody(createSoldRecordsSchema, body);
  if (!validation.success) return validation.response;
  const { items, source, fileName } = validation.data;

  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, code: true, title: true, status: true },
    });
    if (!schedule) return notFound("排程不存在");

    // 校验所有明细行属于该排程（防止跨排程写入）
    const itemRows = await prisma.scheduleItem.findMany({
      where: { id: { in: items.map((it) => it.itemId) } },
      select: { id: true, scheduleId: true },
    });
    const validIds = new Set(
      itemRows.filter((r) => r.scheduleId === scheduleId).map((r) => r.id)
    );
    if (validIds.size !== items.length) {
      return badRequest("存在不属于该排程的明细行");
    }

    const user = getUserFromRequest(req);
    const operatorName = user ? await resolveUsernameToName(user.username) : null;

    const now = new Date();
    await prisma.$transaction(
      items.map((it) =>
        prisma.scheduleItem.update({
          where: { id: it.itemId },
          data: {
            actualSoldQty: it.soldQty,
            // 有值记录回录人与时间；清除回录时一并清空
            soldRecordedAt: it.soldQty != null ? now : null,
            soldRecordedBy: it.soldQty != null ? operatorName : null,
          },
        })
      )
    );

    const recordedCount = items.filter((it) => it.soldQty != null).length;
    const sourceText = source === "import" ? `CSV导入${fileName ? `(${fileName})` : ""}` : "手动录入";
    await logOperation(req, {
      action: "UPDATE",
      entity: "Schedule",
      entityId: scheduleId,
      description: `销售回录(${sourceText}): ${schedule.code ?? schedule.title} · ${recordedCount} 行`,
    });

    return success({
      updatedCount: items.length,
      recordedCount,
      operator: operatorName,
      recordedAt: now.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "POST /api/schedules/[id]/sold-records failed");
    return internalError("销售回录保存失败");
  }
}