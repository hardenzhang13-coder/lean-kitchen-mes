import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const receiptId = Number(id);
  if (isNaN(receiptId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const receipt = await prisma.purchaseReceipt.findUnique({
      where: { id: receiptId },
      include: {
        items: {
          include: {
            ingredient: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: "采购单不存在" }, { status: 404 });
    }

    // 检查是否被已结算报销单关联
    const reimbursements = await prisma.purchaseReimbursement.findMany({
      where: {
        status: "settled",
        receiptIds: { has: receiptId },
      },
    });

    return NextResponse.json({
      ...receipt,
      isSettled: reimbursements.length > 0,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const receiptId = Number(id);
  if (isNaN(receiptId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    // 检查是否被已结算报销单关联
    const reimbursements = await prisma.purchaseReimbursement.findMany({
      where: {
        status: "settled",
        receiptIds: { has: receiptId },
      },
    });

    if (reimbursements.length > 0) {
      return NextResponse.json(
        { error: "该采购单已被结算，无法删除" },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 获取采购单明细，用于回滚库存
      const receipt = await tx.purchaseReceipt.findUnique({
        where: { id: receiptId },
        include: { items: true },
      });

      if (!receipt) {
        throw new Error("采购单不存在");
      }

      // 回滚库存并删除台账记录
      for (const item of receipt.items) {
        if (item.ingredientId) {
          const inventory = await tx.inventory.findUnique({
            where: { ingredientId: item.ingredientId },
          });

          if (inventory) {
            const newQty = Math.max(
              0,
              Number(inventory.currentQty) - Number(item.stockInQty)
            );
            await tx.inventory.update({
              where: { ingredientId: item.ingredientId },
              data: { currentQty: newQty },
            });
          }

          // 删除对应的库存台账记录
          await tx.inventoryLedger.deleteMany({
            where: {
              source: `采购入库/${receiptId}`,
              ingredientId: item.ingredientId,
            },
          });
        }
      }

      // 删除采购单（明细级联删除）
      await tx.purchaseReceipt.delete({
        where: { id: receiptId },
      });
    });

    await logOperation(req, {
      action: "DELETE",
      entity: "PurchaseReceipt",
      entityId: receiptId,
      description: `删除采购单: ${receiptId}`,
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
