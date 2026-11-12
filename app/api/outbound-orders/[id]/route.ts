import { NextRequest } from "next/server";
import { success, notFound } from "@/lib/server/api-response";
import { getOutboundOrderDetail } from "@/lib/server/outbound-detail";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getOutboundOrderDetail(Number(id));
  if (!detail) return notFound("出库单不存在");

  return success(detail);
}
