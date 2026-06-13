import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { enrichOperatorNames } from "@/lib/user-resolve";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const status = searchParams.get("status");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (startDate || endDate) {
    where.receiptDate = {};
    if (startDate) where.receiptDate.gte = new Date(startDate);
    if (endDate) where.receiptDate.lte = new Date(endDate);
  }
  // 不再按 status 在 Prisma 层过滤：数据库中可能同时存在中文状态和英文状态，
  // 统一在后端推导 effectiveStatus 后再过滤，保证列表/tab 与 badge 一致。

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
    const filtered = result.filter((r) => r.status === status);
    return NextResponse.json(filtered);
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    receiptDate,
    supplierId,
    supplierName,
    summary,
    totalAmount,
    imageUrl,
    items,
  }: {
    receiptDate: string;
    supplierId?: number;
    supplierName?: string;
    summary?: string;
    totalAmount: number;
    imageUrl?: string;
    items: Array<{
      ingredientId?: number;
      seasoningIngredientId?: number;
      itemName: string;
      brand?: string;
      l2Code?: string;
      l2Name?: string;
      isManual?: boolean;
      spec?: string;
      qty: number;
      priceUnit?: string;
      purchaseUnit?: string;
      unitPrice: number;
      amount: number;
      stockUnit: string;
      stockInQty: number;
      storage: string;
    }>;
  } = body;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  if (!receiptDate) {
    return NextResponse.json({ error: "请选择采购日期" }, { status: 400 });
  }
  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: "请至少添加一项采购明细" },
      { status: 400 }
    );
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.itemName?.trim()) {
      return NextResponse.json(
        { error: `第 ${i + 1} 行：食材名称不能为空` },
        { status: 400 }
      );
    }
    if (!item.spec?.trim()) {
      return NextResponse.json(
        { error: `第 ${i + 1} 行：采购规格不能为空` },
        { status: 400 }
      );
    }
    if (!item.purchaseUnit) {
      return NextResponse.json(
        { error: `第 ${i + 1} 行：采购单位不能为空` },
        { status: 400 }
      );
    }
    if (!item.stockUnit) {
      return NextResponse.json(
        { error: `第 ${i + 1} 行：入库单位不能为空` },
        { status: 400 }
      );
    }
    if (!item.qty || Number(item.qty) <= 0) {
      return NextResponse.json(
        { error: `第 ${i + 1} 行：数量必须大于 0` },
        { status: 400 }
      );
    }
    if (item.stockInQty == null || Number(item.stockInQty) < 0) {
      return NextResponse.json(
        { error: `第 ${i + 1} 行：入库数量不能小于 0` },
        { status: 400 }
      );
    }
    if (item.amount == null || Number(item.amount) < 0) {
      return NextResponse.json(
        { error: `第 ${i + 1} 行：采购金额不能为负数` },
        { status: 400 }
      );
    }
    if (!item.ingredientId && !item.seasoningIngredientId) {
      return NextResponse.json(
        { error: `第 ${i + 1} 行：请先完成食材匹配` },
        { status: 400 }
      );
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.create({
        data: {
          receiptDate: new Date(receiptDate),
          supplierId: supplierId || null,
          supplierName: supplierName || null,
          summary: summary || null,
          totalAmount: Number(totalAmount),
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
            isManual: item.isManual || false,
            spec: item.spec || null,
            qty: Number(item.qty),
            priceUnit: item.purchaseUnit || item.priceUnit || "件",
            purchaseUnit: item.purchaseUnit || item.priceUnit || "件",
            unitPrice: Number(item.unitPrice),
            amount: Number(item.amount),
            stockUnit: item.stockUnit,
            stockInQty: Number(item.stockInQty),
            storage: item.storage || "常温",
          },
        });

        // 更新原料最新参照单价与库存
        if (item.ingredientId) {
          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: { latestRefPrice: Number(item.unitPrice) },
          });

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

        // 更新调料最新参照单价
        if (item.seasoningIngredientId) {
          await tx.seasoningIngredient.update({
            where: { id: item.seasoningIngredientId },
            data: { latestRefPrice: Number(item.unitPrice) },
          });
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
    console.error("[PurchaseReceipt POST] error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
