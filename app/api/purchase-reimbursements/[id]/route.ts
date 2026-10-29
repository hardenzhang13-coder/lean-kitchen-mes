import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { success } from "@/lib/server/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.purchaseReimbursement.findUnique({
    where: { id: Number(id) },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 获取关联的采购单
  const receipts = await prisma.purchaseReceipt.findMany({
    where: { reimbursementId: row.id },
    select: { id: true, receiptDate: true, summary: true, totalAmount: true, operator: true },
  });

  return success({ ...row, receipts });
}
