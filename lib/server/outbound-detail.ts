import { prisma } from "@/lib/server/prisma";
import { round2 } from "@/lib/shared/prepped-stock";

export async function getOutboundOrderDetail(id: number) {
  const order = await prisma.outboundOrder.findUnique({
    where: { id },
    include: {
      store: { select: { name: true } },
      items: { orderBy: { sortIndex: "asc" } },
    },
  });

  if (!order) return null;

  return {
    id: order.id,
    code: order.code,
    storeId: order.storeId,
    storeName: order.store.name,
    scheduleId: order.scheduleId,
    scheduleCode: order.scheduleCode,
    scheduleTitle: order.scheduleTitle,
    scheduleDate: order.scheduleDate.toISOString(),
    totalPortions: round2(Number(order.totalPortions)),
    totalAmount: round2(Number(order.totalAmount)),
    asPlanned: order.asPlanned,
    status: order.status,
    operator: order.operator ?? "—",
    remark: order.remark,
    createdAt: order.createdAt.toISOString(),
    voidedAt: order.voidedAt?.toISOString() ?? null,
    voidReason: order.voidReason,
    items: order.items.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      code: item.itemCode,
      name: item.itemName,
      l1Name: item.l1Name ?? "—",
      l2Name: item.l2Name ?? "—",
      packageSpec: item.packageSpec,
      requiredPortions: round2(Number(item.requiredPortions)),
      requiredQty: round2(Number(item.requiredQty)),
      availablePortions: round2(Number(item.availablePortions)),
      shippedPortions: round2(Number(item.shippedPortions)),
      shippedQty: round2(Number(item.shippedQty)),
      pricePerJin:
        item.pricePerJin != null ? round2(Number(item.pricePerJin)) : null,
      amount: round2(Number(item.amount)),
      prepStatus: item.prepStatus,
      sortIndex: item.sortIndex,
    })),
  };
}
