import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";

export async function GET() {
  const rows = await prisma.schedule.findMany({
    where: { status: "进行中" },
    orderBy: { scheduleDate: "desc" },
    include: {
      items: {
        include: {
          dish: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  const enriched = rows.map((r) => ({
    ...r,
    totalQuantity: r.items.reduce((s, it) => s + it.quantity, 0),
    dishCount: r.items.length,
  }));

  return success(enriched);
}
