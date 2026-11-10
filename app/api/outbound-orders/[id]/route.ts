import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { success, notFound } from "@/lib/server/api-response";
import { round2 } from "@/lib/shared/prepped-stock";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.outboundOrder.findUnique({
    where: { id: Number(id) },
    include: {
      store: { select: { name: true } },
      items: { orderBy: { sortIndex: "asc" } },
    },
  });
  if (!order) return notFound("出库单不存在");

  return success({
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
    items: order.items.map((it) => ({
      id: it.id,
      sourceType: it.sourceType,
      code: it.itemCode,
      name: it.itemName,
      l1Name: it.l1Name ?? "—",
      l2Name: it.l2Name ?? "—",
      packageSpec: it.packageSpec,
      requiredPortions: round2(Number(it.requiredPortions)),
      requiredQty: round2(Number(it.requiredQty)),
      availablePortions: round2(Number(it.availablePortions)),
      shippedPortions: round2(Number(it.shippedPortions)),
      shippedQty: round2(Number(it.shippedQty)),
      pricePerJin: it.pricePerJin != null ? round2(Number(it.pricePerJin)) : null,
      amount: round2(Number(it.amount)),
      prepStatus: it.prepStatus,
      sortIndex: it.sortIndex,
    })),
  });
}