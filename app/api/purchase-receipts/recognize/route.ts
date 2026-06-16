import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recognizePurchaseReceipt } from "@/lib/ai";
import { calculateStockInfo } from "@/lib/spec-parser";
import { logError } from "@/lib/logger";
import { computeImageHash } from "@/lib/utils";

async function findSeasoningCategory() {
  const l2Cats = await prisma.ingredientCategoryL2.findMany({
    include: { parent: { select: { code: true, name: true } } },
  });
  const seasoningL2 = l2Cats.find(
    (c) =>
      c.name === "调料" ||
      (c.name === "调味品" && c.parent?.name === "调味品")
  );
  if (seasoningL2) {
    return { code: seasoningL2.code, name: seasoningL2.name };
  }
  // 兼容旧数据：查找名为“调味品”且父级为米面粮油的二级分类
  const legacy = l2Cats.find(
    (c) => c.name === "调味品" && c.parent?.name === "米面粮油"
  );
  return legacy
    ? { code: legacy.code, name: legacy.name }
    : { code: "SEA-SEA", name: "调料" };
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "请上传图片" }, { status: 400 });
    }

    console.log("[AI] 开始识别采购单图片...");

    const imageHash = computeImageHash(imageBase64);
    const duplicate = await prisma.purchaseReceipt.findFirst({
      where: { imageHash, status: { not: "已作废" } },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    const recognized = await recognizePurchaseReceipt(imageBase64);

    console.log(`[AI] 识别完成，原始物料数: ${recognized.items?.length || 0}`);
    if (recognized.supplierName) {
      console.log(`[AI] 识别到供应商: ${recognized.supplierName}`);
    }

    const [ingredients, seasonings, l2Categories, units, seasoningL2] = await Promise.all([
      prisma.ingredient.findMany({
        select: {
          id: true,
          name: true,
          alias: true,
          l2Code: true,
          unit: true,
          priceUnit: true,
          purchaseUnit: true,
          stockUnit: true,
          brand: true,
          storage: true,
        },
      }),
      prisma.seasoningIngredient.findMany({
        select: {
          id: true,
          name: true,
          brand: true,
          purchaseUnit: true,
          stockUnit: true,
          storage: true,
          l2Code: true,
        },
      }),
      prisma.ingredientCategoryL2.findMany({
        select: { code: true, name: true, parentCode: true },
      }),
      prisma.unit.findMany({ select: { name: true } }),
      findSeasoningCategory(),
    ]);

    const unitNames = units.map((u) => u.name);
    const l2NameMap = new Map(l2Categories.map((c) => [c.code, c.name]));

    // 供应商自动识别/创建
    let supplierId: number | undefined;
    let supplierName: string | undefined;
    if (recognized.supplierName) {
      supplierName = recognized.supplierName.trim();
      const existing = await prisma.supplier.findFirst({
        where: { name: { equals: supplierName, mode: "insensitive" } },
      });
      if (existing) {
        supplierId = existing.id;
      } else {
        const created = await prisma.supplier.create({ data: { name: supplierName } });
        supplierId = created.id;
      }
    }

    const matchedItems = recognized.items.map((item) => {
      const productName = item.productName || item.name?.trim() || "";
      const ingredientName = item.ingredientName?.trim() || productName;
      const brandPrefix = item.brand?.trim();
      const spec = item.spec?.trim();
      const qty = item.qty ?? 1;
      const purchaseUnit = item.purchaseUnit || item.unit || "件";

      // 产品品牌名称/别名保存完整文本；食材名称使用提取后的 ingredientName
      const displayBrand = productName || brandPrefix || "";
      const displayItemName = ingredientName || productName;

      // 先匹配原料（按食材名称完全匹配）
      const ingMatch = ingredients.find(
        (i) =>
          i.name === displayItemName ||
          i.alias === displayItemName
      );
      if (ingMatch) {
        const isJin = purchaseUnit === "斤";
        const stockInfo = isJin
          ? { stockUnit: "斤", stockInQty: qty }
          : item.stockUnit && item.stockQty != null
            ? { stockUnit: item.stockUnit, stockInQty: item.stockQty }
            : calculateStockInfo({ spec: spec || "", qty, unitNames });

        return {
          name: productName,
          brand: displayBrand || ingMatch.brand || "",
          spec: spec || "",
          qty,
          purchaseUnit,
          unitPrice: item.unitPrice ?? 0,
          amount: item.amount ?? qty * (item.unitPrice ?? 0),
          stockUnit: stockInfo.stockUnit || ingMatch.stockUnit || ingMatch.unit || purchaseUnit,
          stockInQty: stockInfo.stockInQty ?? 1,
          storage: ingMatch.storage,
          categoryName: item.categoryName,
          matched: true,
          matchType: "原料" as const,
          ingredientId: ingMatch.id,
          itemName: displayItemName || ingMatch.name,
          l2Code: ingMatch.l2Code,
          l2Name: l2NameMap.get(ingMatch.l2Code) || item.categoryName || "",
          category: "原料",
        };
      }

      // 再匹配调料（调料不入原料库存，ingredientId 留空）
      const seaMatch = seasonings.find(
        (s) =>
          s.name === displayItemName
      );
      if (seaMatch) {
        const isJin = purchaseUnit === "斤";
        const stockInfo = isJin
          ? { stockUnit: "斤", stockInQty: qty }
          : item.stockUnit && item.stockQty != null
            ? { stockUnit: item.stockUnit, stockInQty: item.stockQty }
            : calculateStockInfo({ spec: spec || "", qty, unitNames });

        return {
          name: productName,
          brand: displayBrand || seaMatch.brand || "",
          spec: spec || "",
          qty,
          purchaseUnit,
          unitPrice: item.unitPrice ?? 0,
          amount: item.amount ?? qty * (item.unitPrice ?? 0),
          stockUnit: stockInfo.stockUnit || seaMatch.stockUnit || seaMatch.purchaseUnit || purchaseUnit,
          stockInQty: stockInfo.stockInQty ?? 1,
          storage: seaMatch.storage,
          categoryName: item.categoryName,
          matched: true,
          matchType: "调料" as const,
          ingredientId: null,
          seasoningIngredientId: seaMatch.id,
          itemName: displayItemName || seaMatch.name,
          l2Code: seaMatch.l2Code || seasoningL2.code,
          l2Name: seaMatch.l2Code ? l2NameMap.get(seaMatch.l2Code) || seasoningL2.name : seasoningL2.name,
          category: "调料",
        };
      }

      // 未匹配
      const isJin = purchaseUnit === "斤";
      const stockInfo = isJin
        ? { stockUnit: "斤", stockInQty: qty }
        : calculateStockInfo({ spec: spec || "", qty, unitNames });
      return {
        name: productName,
        brand: displayBrand || "",
        spec: spec || "",
        qty,
        purchaseUnit,
        unitPrice: item.unitPrice ?? 0,
        amount: item.amount ?? qty * (item.unitPrice ?? 0),
        stockUnit: stockInfo.stockUnit || purchaseUnit,
        stockInQty: stockInfo.stockInQty ?? 1,
        storage: "常温",
        categoryName: item.categoryName,
        matched: false,
        matchType: "未匹配" as const,
        ingredientId: null,
        itemName: displayItemName || productName,
        l2Code: null,
        l2Name: item.categoryName || "",
        category: "未匹配",
      };
    });

    const matchedCount = matchedItems.filter((i) => i.matched).length;
    console.log(`[AI] 匹配完成，已匹配: ${matchedCount}/${matchedItems.length}`);

    return NextResponse.json({
      items: matchedItems,
      summary: recognized.summary,
      totalAmount: recognized.totalAmount,
      supplierId,
      supplierName,
      imageHash,
      duplicateWarning: duplicate
        ? {
            receiptId: duplicate.id,
            message: `检测到该采购单图片已录入（采购单 #${duplicate.id}）`,
          }
        : undefined,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logError(e, { context: "POST /api/purchase-receipts/recognize" });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
