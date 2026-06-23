import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { enrichOperatorNames } from "@/lib/user-resolve";
import { created, internalError, paginated } from "@/lib/api-response";
import { createPurchaseReceiptSchema, purchaseReceiptQuerySchema } from "@/lib/schemas/purchase";
import { validateBody, validateQuery } from "@/lib/validate";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(purchaseReceiptQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { startDate, endDate, status, page, pageSize, q } = validation.data;

    const reimbursements = await prisma.purchaseReimbursement.findMany({
      where: { status: "settled" },
      select: { receiptIds: true },
    });

    const settledReceiptIds = new Set<number>();
    for (const r of reimbursements) {
      for (const id of r.receiptIds) {
        settledReceiptIds.add(id);
      }
    }

    const where: Prisma.PurchaseReceiptWhereInput = {};
    if (startDate || endDate) {
      where.receiptDate = {};
      if (startDate) where.receiptDate.gte = new Date(startDate);
      if (endDate) where.receiptDate.lte = new Date(endDate);
    }

    const conditions: Prisma.PurchaseReceiptWhereInput[] = [];

    if (q) {
      const query = q.trim();
      const queryId = Number(query);
      const or: Prisma.PurchaseReceiptWhereInput[] = [
        { summary: { contains: query, mode: "insensitive" } },
        { supplierName: { contains: query, mode: "insensitive" } },
        { operator: { contains: query, mode: "insensitive" } },
      ];
      if (!isNaN(queryId)) {
        or.push({ id: { equals: queryId } });
      }
      conditions.push({ OR: or });
    }

    if (status === "已作废") {
      conditions.push({ status: { in: ["已作废", "voided", "cancelled"] } });
    } else if (status === "已结算") {
      conditions.push({
        OR: [
          { status: { in: ["已结算", "settled", "paid"] } },
          { id: { in: Array.from(settledReceiptIds) } },
        ],
      });
    } else if (status === "待结算") {
      conditions.push({
        AND: [
          {
            status: {
              notIn: ["已作废", "voided", "cancelled", "已结算", "settled", "paid"],
            },
          },
          { id: { notIn: Array.from(settledReceiptIds) } },
        ],
      });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const skip = (page - 1) * pageSize;

    const [receipts, totalCount] = await Promise.all([
      prisma.purchaseReceipt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        omit: { imageUrl: true, imageHash: true },
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              ingredient: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      prisma.purchaseReceipt.count({ where }),
    ]);

    const result = (await enrichOperatorNames(receipts)).map((r) => {
      const isSettled =
        settledReceiptIds.has(r.id) ||
        ["已结算", "settled", "paid"].includes(r.status || "");
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

    return paginated(result, {
      page,
      pageSize,
      totalItems: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    });
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

    const { receiptDate, supplierId, supplierName, summary, totalAmount, imageUrl, imageHash, purchasingUnit, items } =
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
          imageHash: imageHash || null,
          purchasingUnit,
          status: "待结算",
        },
      });

      for (const item of items) {
        await tx.purchaseReceiptItem.create({
          data: {
            receiptId: receipt.id,
            ingredientId: item.ingredientId || null,
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
