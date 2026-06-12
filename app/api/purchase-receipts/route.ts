import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { enrichOperatorNames } from "@/lib/user-resolve";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: any = {};
  if (startDate || endDate) {
    where.receiptDate = {};
    if (startDate) where.receiptDate.gte = new Date(startDate);
    if (endDate) where.receiptDate.lte = new Date(endDate);
  }

  const [receipts, reimbursements] = await Promise.all([
    prisma.purchaseReceipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            ingredient: { select: { id: true, name: true, code: true } },
          },
        },
      },
    }),
    prisma.purchaseReimbursement.findMany({
      where: { status: "settled" },
      select: { receiptIds: true },
    }),
  ]);

  // 构建已结算的采购单ID集合
  const settledReceiptIds = new Set<number>();
  for (const r of reimbursements) {
    for (const id of r.receiptIds) {
      settledReceiptIds.add(id);
    }
  }

  const result = (await enrichOperatorNames(receipts)).map((r) => ({
    ...r,
    isSettled: settledReceiptIds.has(r.id),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    receiptDate,
    supplierId,
    summary,
    totalAmount,
    imageUrl,
    items,
  }: {
    receiptDate: string;
    supplierId?: number;
    summary?: string;
    totalAmount: number;
    imageUrl?: string;
    items: Array<{
      ingredientId?: number;
      itemName: string;
      spec?: string;
      qty: number;
      priceUnit: string;
      unitPrice: number;
      amount: number;
      stockUnit: string;
      stockInQty: number;
      storage: string;
    }>;
  } = body;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 创建采购单
      const receipt = await tx.purchaseReceipt.create({
        data: {
          receiptDate: new Date(receiptDate),
          supplierId: supplierId || null,
          summary: summary || null,
          totalAmount: Number(totalAmount),
          operator,
          imageUrl: imageUrl || null,
          status: "completed",
        },
      });

      // 创建明细并入库
      for (const item of items) {
        await tx.purchaseReceiptItem.create({
          data: {
            receiptId: receipt.id,
            ingredientId: item.ingredientId || null,
            itemName: item.itemName,
            spec: item.spec || null,
            qty: Number(item.qty),
            priceUnit: item.priceUnit,
            unitPrice: Number(item.unitPrice),
            amount: Number(item.amount),
            stockUnit: item.stockUnit,
            stockInQty: Number(item.stockInQty),
            storage: item.storage,
          },
        });

        // 如果有匹配的 ingredientId，更新库存
        if (item.ingredientId) {
          const existing = await tx.inventory.findUnique({
            where: { ingredientId: item.ingredientId },
          });

          if (existing) {
            const newQty = Number(existing.currentQty) + Number(item.stockInQty);
            await tx.inventory.update({
              where: { ingredientId: item.ingredientId },
              data: { currentQty: newQty, unit: item.stockUnit },
            });
            await tx.inventoryLedger.create({
              data: {
                ingredientId: item.ingredientId,
                changeType: "入库",
                changeQty: Number(item.stockInQty),
                unit: item.stockUnit,
                balance: newQty,
                source: `采购入库/${receipt.id}`,
                operator,
              },
            });
          } else {
            await tx.inventory.create({
              data: {
                ingredientId: item.ingredientId,
                currentQty: Number(item.stockInQty),
                unit: item.stockUnit,
              },
            });
            await tx.inventoryLedger.create({
              data: {
                ingredientId: item.ingredientId,
                changeType: "入库",
                changeQty: Number(item.stockInQty),
                unit: item.stockUnit,
                balance: Number(item.stockInQty),
                source: `采购入库/${receipt.id}`,
                operator,
              },
            });
          }
        }
      }

      return receipt;
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "PurchaseReceipt",
      entityId: result.id,
      description: `录入采购单: ${result.id}`,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
