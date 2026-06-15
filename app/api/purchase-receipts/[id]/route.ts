import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { success, badRequest, notFound, internalError } from "@/lib/api-response";
import { idParamSchema } from "@/lib/schemas/common";
import { validateBody } from "@/lib/validate";
import { logger } from "@/lib/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validation = validateBody(idParamSchema, { id: Number(id) });
    if (!validation.success) return validation.response;

    const receiptId = validation.data.id;
    const receipt = await prisma.purchaseReceipt.findUnique({
      where: { id: receiptId },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            ingredient: { select: { id: true, name: true, code: true } },
            seasoningIngredient: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!receipt) {
      return notFound("采购单不存在");
    }

    const reimbursements = await prisma.purchaseReimbursement.findMany({
      where: {
        status: "settled",
        receiptIds: { has: receiptId },
      },
    });

    return success({
      ...receipt,
      supplierName: receipt.supplier?.name || receipt.supplierName,
      isSettled: reimbursements.length > 0,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/purchase-receipts/[id] failed");
    return internalError("获取采购单失败");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validation = validateBody(idParamSchema, { id: Number(id) });
    if (!validation.success) return validation.response;

    const receiptId = validation.data.id;

    const reimbursements = await prisma.purchaseReimbursement.findMany({
      where: {
        status: "settled",
        receiptIds: { has: receiptId },
      },
    });

    if (reimbursements.length > 0) {
      return badRequest("该采购单已被结算，无法作废");
    }

    await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.findUnique({
        where: { id: receiptId },
        include: { items: true },
      });

      if (!receipt) {
        throw new Error("采购单不存在");
      }

      for (const item of receipt.items) {
        if (item.ingredientId) {
          const inventory = await tx.inventory.findUnique({
            where: { ingredientId: item.ingredientId },
          });

          if (inventory) {
            const newQty = Math.max(0, Number(inventory.currentQty) - Number(item.stockInQty));
            await tx.inventory.update({
              where: { ingredientId: item.ingredientId },
              data: { currentQty: newQty },
            });
          }

          await tx.inventoryLedger.deleteMany({
            where: {
              source: `采购入库/${receiptId}`,
              ingredientId: item.ingredientId,
            },
          });
        }
      }

      await tx.purchaseReceipt.update({
        where: { id: receiptId },
        data: { status: "已作废" },
      });
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "PurchaseReceipt",
      entityId: receiptId,
      description: `作废采购单: ${receiptId}`,
    });

    return success({ message: "采购单已作废" });
  } catch (err) {
    logger.error({ err }, "DELETE /api/purchase-receipts/[id] failed");
    return internalError("作废采购单失败");
  }
}
