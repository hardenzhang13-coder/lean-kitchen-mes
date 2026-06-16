import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { success, badRequest, notFound, internalError } from "@/lib/api-response";
import { idParamSchema } from "@/lib/schemas/common";
import { createPurchaseReceiptSchema } from "@/lib/schemas/purchase";
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
    const force = req.nextUrl.searchParams.get("force") === "true";

    const receipt = await prisma.purchaseReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      return notFound("采购单不存在");
    }

    if (force) {
      if (receipt.status !== "已作废") {
        return badRequest("只能删除已作废的采购单");
      }

      const reimbursements = await prisma.purchaseReimbursement.findMany({
        where: {
          status: "settled",
          receiptIds: { has: receiptId },
        },
      });
      if (reimbursements.length > 0) {
        return badRequest("该采购单已被结算，无法删除");
      }

      await prisma.purchaseReceipt.delete({
        where: { id: receiptId },
      });

      await logOperation(req, {
        action: "DELETE",
        entity: "PurchaseReceipt",
        entityId: receiptId,
        description: `物理删除已作废采购单: ${receiptId}`,
      });

      return success({ message: "采购单已彻底删除" });
    }

    // 非 force：执行作废逻辑
    const reimbursements = await prisma.purchaseReimbursement.findMany({
      where: {
        status: "settled",
        receiptIds: { has: receiptId },
      },
    });

    if (reimbursements.length > 0) {
      return badRequest("该采购单已被结算，无法作废");
    }

    if (receipt.status === "已作废") {
      return badRequest("采购单已作废");
    }

    await prisma.$transaction(async (tx) => {
      const receiptWithItems = await tx.purchaseReceipt.findUnique({
        where: { id: receiptId },
        include: { items: true },
      });

      if (!receiptWithItems) {
        throw new Error("采购单不存在");
      }

      for (const item of receiptWithItems.items) {
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

        if (item.seasoningIngredientId) {
          const inventory = await tx.inventory.findUnique({
            where: { seasoningIngredientId: item.seasoningIngredientId },
          });

          if (inventory) {
            const newQty = Math.max(0, Number(inventory.currentQty) - Number(item.stockInQty));
            await tx.inventory.update({
              where: { seasoningIngredientId: item.seasoningIngredientId },
              data: { currentQty: newQty },
            });
          }

          await tx.inventoryLedger.deleteMany({
            where: {
              source: `采购入库/${receiptId}`,
              seasoningIngredientId: item.seasoningIngredientId,
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const validation = validateBody(idParamSchema, { id: Number(id) });
    if (!validation.success) return validation.response;

    const receiptId = validation.data.id;
    const body = await req.json();
    const bodyValidation = validateBody(createPurchaseReceiptSchema, body);
    if (!bodyValidation.success) return bodyValidation.response;

    const { receiptDate, supplierId, supplierName, summary, totalAmount, imageUrl, imageHash, purchasingUnit, items } =
      bodyValidation.data;

    const user = getUserFromRequest(req);
    const operator = user?.username || null;

    const existing = await prisma.purchaseReceipt.findUnique({
      where: { id: receiptId },
      include: { items: true },
    });

    if (!existing) {
      return notFound("采购单不存在");
    }

    if (existing.status !== "待结算") {
      return badRequest("只有待结算的采购单可以编辑");
    }

    await prisma.$transaction(async (tx) => {
      for (const oldItem of existing.items) {
        if (oldItem.ingredientId) {
          const inventory = await tx.inventory.findUnique({
            where: { ingredientId: oldItem.ingredientId },
          });
          if (inventory) {
            const newQty = Math.max(0, Number(inventory.currentQty) - Number(oldItem.stockInQty));
            await tx.inventory.update({
              where: { ingredientId: oldItem.ingredientId },
              data: { currentQty: newQty },
            });
          }
          await tx.inventoryLedger.deleteMany({
            where: {
              source: `采购入库/${receiptId}`,
              ingredientId: oldItem.ingredientId,
            },
          });
        }

        if (oldItem.seasoningIngredientId) {
          const inventory = await tx.inventory.findUnique({
            where: { seasoningIngredientId: oldItem.seasoningIngredientId },
          });
          if (inventory) {
            const newQty = Math.max(0, Number(inventory.currentQty) - Number(oldItem.stockInQty));
            await tx.inventory.update({
              where: { seasoningIngredientId: oldItem.seasoningIngredientId },
              data: { currentQty: newQty },
            });
          }
          await tx.inventoryLedger.deleteMany({
            where: {
              source: `采购入库/${receiptId}`,
              seasoningIngredientId: oldItem.seasoningIngredientId,
            },
          });
        }
      }

      await tx.purchaseReceiptItem.deleteMany({
        where: { receiptId },
      });

      await tx.purchaseReceipt.update({
        where: { id: receiptId },
        data: {
          receiptDate: new Date(receiptDate),
          supplierId: supplierId || null,
          supplierName: supplierName || null,
          summary: summary || null,
          totalAmount,
          imageUrl: imageUrl || null,
          imageHash: imageHash || null,
          purchasingUnit,
        },
      });

      for (const item of items) {
        await tx.purchaseReceiptItem.create({
          data: {
            receiptId,
            ingredientId: item.ingredientId || null,
            seasoningIngredientId: item.seasoningIngredientId || null,
            itemName: item.itemName,
            brand: item.brand || null,
            l2Code: item.l2Code,
            l2Name: item.l2Name,
            isManual: item.isManual,
            spec: item.spec,
            qty: item.qty,
            priceUnit: item.purchaseUnit || item.priceUnit || "件",
            purchaseUnit: item.purchaseUnit || item.priceUnit || "件",
            unitPrice: item.unitPrice,
            amount: item.amount,
            stockUnit: item.stockUnit,
            stockInQty: item.stockInQty,
            storage: item.storage,
          },
        });

        if (item.ingredientId) {
          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: { latestRefPrice: item.unitPrice },
          });

          const inv = await tx.inventory.findUnique({
            where: { ingredientId: item.ingredientId },
          });
          if (inv) {
            const newQty = Number(inv.currentQty) + item.stockInQty;
            await tx.inventory.update({
              where: { ingredientId: item.ingredientId },
              data: { currentQty: newQty, unit: item.stockUnit },
            });
            await tx.inventoryLedger.create({
              data: {
                ingredientId: item.ingredientId,
                changeType: "入库",
                changeQty: item.stockInQty,
                unit: item.stockUnit,
                balance: newQty,
                source: `采购入库/${receiptId}`,
                operator,
              },
            });
          } else {
            await tx.inventory.create({
              data: {
                ingredientId: item.ingredientId,
                currentQty: item.stockInQty,
                unit: item.stockUnit,
              },
            });
            await tx.inventoryLedger.create({
              data: {
                ingredientId: item.ingredientId,
                changeType: "入库",
                changeQty: item.stockInQty,
                unit: item.stockUnit,
                balance: item.stockInQty,
                source: `采购入库/${receiptId}`,
                operator,
              },
            });
          }
        }

        if (item.seasoningIngredientId) {
          await tx.seasoningIngredient.update({
            where: { id: item.seasoningIngredientId },
            data: { latestRefPrice: item.unitPrice },
          });

          const inv = await tx.inventory.findUnique({
            where: { seasoningIngredientId: item.seasoningIngredientId },
          });
          if (inv) {
            const newQty = Number(inv.currentQty) + item.stockInQty;
            await tx.inventory.update({
              where: { seasoningIngredientId: item.seasoningIngredientId },
              data: { currentQty: newQty, unit: item.stockUnit },
            });
            await tx.inventoryLedger.create({
              data: {
                seasoningIngredientId: item.seasoningIngredientId,
                changeType: "入库",
                changeQty: item.stockInQty,
                unit: item.stockUnit,
                balance: newQty,
                source: `采购入库/${receiptId}`,
                operator,
              },
            });
          } else {
            await tx.inventory.create({
              data: {
                seasoningIngredientId: item.seasoningIngredientId,
                currentQty: item.stockInQty,
                unit: item.stockUnit,
              },
            });
            await tx.inventoryLedger.create({
              data: {
                seasoningIngredientId: item.seasoningIngredientId,
                changeType: "入库",
                changeQty: item.stockInQty,
                unit: item.stockUnit,
                balance: item.stockInQty,
                source: `采购入库/${receiptId}`,
                operator,
              },
            });
          }
        }
      }
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "PurchaseReceipt",
      entityId: receiptId,
      description: `编辑采购单: ${receiptId}`,
    });

    return success({ message: "采购单已更新" });
  } catch (err) {
    logger.error({ err }, "PUT /api/purchase-receipts/[id] failed");
    return internalError("更新采购单失败");
  }
}
