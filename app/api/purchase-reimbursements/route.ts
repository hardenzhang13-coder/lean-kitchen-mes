import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { enrichOperatorNames } from "@/lib/user-resolve";

export async function GET() {
  const rows = await prisma.purchaseReimbursement.findMany({
    orderBy: { createdAt: "desc" },
  });
  const enriched = await enrichOperatorNames(rows);
  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, summary, receiptIds }: {
    title: string;
    summary?: string;
    receiptIds: number[];
  } = body;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  try {
    // 计算总金额
    const receipts = await prisma.purchaseReceipt.findMany({
      where: { id: { in: receiptIds } },
      select: { totalAmount: true },
    });
    const totalAmount = receipts.reduce((s, r) => s + Number(r.totalAmount), 0);

    const row = await prisma.$transaction(async (tx) => {
      // 创建报销单
      const reimbursement = await tx.purchaseReimbursement.create({
        data: {
          title,
          summary: summary || null,
          receiptIds,
          totalAmount,
          operator,
        },
      });

      // 将关联采购单产生的入库 ledger 标记为已结算，并更新采购单状态
      for (const receiptId of receiptIds) {
        await tx.inventoryLedger.updateMany({
          where: {
            source: `采购入库/${receiptId}`,
            settlementStatus: "待结算",
          },
          data: {
            settlementStatus: "已结算",
          },
        });
        await tx.purchaseReceipt.update({
          where: { id: receiptId },
          data: { status: "已结算" },
        });
      }

      return reimbursement;
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "PurchaseReimbursement",
      entityId: row.id,
      description: `创建采购报销: ${title}`,
    });

    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
