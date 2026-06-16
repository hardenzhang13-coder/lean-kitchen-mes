import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { enrichOperatorNames } from "@/lib/user-resolve";
import { success, created, internalError } from "@/lib/api-response";
import { createPurchaseReceiptSchema, purchaseReceiptQuerySchema } from "@/lib/schemas/purchase";
import { validateBody, validateQuery } from "@/lib/validate";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(purchaseReceiptQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { startDate, endDate, status } = validation.data;

    const where: Prisma.PurchaseReceiptWhereInput = {};
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
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              ingredient: { select: { id: true, name: true, code: true } },
              seasoningIngredient: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      prisma.purchaseReimbursement.findMany({
        where: { status: "settled" },
        select: { receiptIds: true },
      }),
    ]);

    const settledReceiptIds = new Set<number>();
    for (const r of reimbursements) {
      for (const id of r.receiptIds) {
        settledReceiptIds.add(id);
      }
    }

    const result = (await enrichOperatorNames(receipts)).map((r) => {
      const isSettled = settledReceiptIds.has(r.id);
      const rawStatus = r.status || "";
      let effectiveStatus: string;
      if (
        rawStatus === "已作废" ||
        rawStatus === "voided" ||
        rawStatus === "cancelled"
      ) {
        effectiveStatus = "已作废";
      } else if (
        rawStatus === "已结算" ||
        rawStatus === "settled" ||
        rawStatus === "paid" ||
        isSettled
      ) {
        effectiveStatus = "已结算";
      } else {
        effectiveStatus = "待结算";
      }
      return {
        ...r,
        supplierName: r.supplier?.name || r.supplierName,
        isSettled,
        status: effectiveStatus,
      };
    });

    if (status) {
      return success(result.filter((r) => r.status === status));
    }

    return success(result);
  } catch (err) {
    logger.error({ err }, "GET /api/purchase-receipts failed");
    return internalError("获取采购单失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createPurchaseReceiptSchema, body);
    if (!validation.success) return validation.response;

    const { receiptDate, supplierId, supplierName, summary, totalAmount, imageUrl, items } =
      validation.data;

    const user = getUserFromRequest(req);
    const operator = user?.username || null;

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.create({
        data: {
          receiptDate: new Date(receiptDate),
          supplierId: supplierId || null,
          supplierName: supplierName || null,
          summary: summary || null,
          totalAmount,
          operator,
          imageUrl: imageUrl || null,
          status: "待结算",
        },
      });

      for (const item of items) {
        await tx.purchaseReceiptItem.create({
          data: {
            receiptId: receipt.id,
            ingredientId: item.ingredientId || null,
            seasoningIngredientId: item.seasoningIngredientId || null,
            itemName: item.itemName,
            brand: item.brand || null,
            l2Code: item.l2Code || null,
            l2Name: item.l2Name || null,
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

          const existing = await tx.inventory.findUnique({
            where: { ingredientId: item.ingredientId },
          });

          if (existing) {
            const newQty = Number(existing.currentQty) + item.stockInQty;
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
                source: `采购入库/${receipt.id}`,
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
                source: `采购入库/${receipt.id}`,
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

          const existing = await tx.inventory.findUnique({
            where: { seasoningIngredientId: item.seasoningIngredientId },
          });

          if (existing) {
            const newQty = Number(existing.currentQty) + item.stockInQty;
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
                source: `采购入库/${receipt.id}`,
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

    return created(result);
  } catch (err) {
    logger.error({ err }, "POST /api/purchase-receipts failed");
    return internalError("录入采购单失败");
  }
}
