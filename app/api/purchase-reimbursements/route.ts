import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { enrichOperatorNames } from "@/lib/user-resolve";
import { paginated, internalError } from "@/lib/api-response";
import { paginationQuerySchema } from "@/lib/schemas/common";
import { createPurchaseReimbursementSchema } from "@/lib/schemas/purchase-reimbursement";
import { validateBody, validateQuery } from "@/lib/validate";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { page, pageSize } = validation.data;
    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.purchaseReimbursement.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.purchaseReimbursement.count(),
    ]);

    const enriched = await enrichOperatorNames(rows);
    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(enriched, { page, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取报销单失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createPurchaseReimbursementSchema, body);
    if (!validation.success) return validation.response;

    const { title, summary, receiptIds } = validation.data;

    const user = getUserFromRequest(req);
    const operator = user?.username || null;

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
