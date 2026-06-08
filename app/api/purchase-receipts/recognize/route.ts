import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recognizePurchaseReceipt } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "请上传图片" }, { status: 400 });
    }

    // 调用 AI 识别
    const recognized = await recognizePurchaseReceipt(imageBase64);

    // 获取所有原料和调料用于匹配
    const [ingredients, seasonings] = await Promise.all([
      prisma.ingredient.findMany({ select: { id: true, name: true, alias: true, unit: true, priceUnit: true, storage: true } }),
      prisma.seasoningIngredient.findMany({ select: { id: true, name: true, brand: true, purchaseUnit: true, storage: true } }),
    ]);

    // 匹配逻辑
    const matchedItems = recognized.items.map((item) => {
      const name = item.name;
      // 先匹配原料
      const ingMatch = ingredients.find(
        (i) => i.name === name || i.alias === name || name.includes(i.name) || i.name.includes(name)
      );
      if (ingMatch) {
        return {
          ...item,
          matched: true,
          matchType: "原料" as const,
          ingredientId: ingMatch.id,
          itemName: ingMatch.name,
          stockUnit: ingMatch.unit,
          priceUnit: item.unit || ingMatch.priceUnit,
          storage: ingMatch.storage,
          category: "原料",
        };
      }
      // 再匹配调料（调料不入原料库存，ingredientId 留空）
      const seaMatch = seasonings.find(
        (s) => s.name === name || name.includes(s.name) || s.name.includes(name)
      );
      if (seaMatch) {
        return {
          ...item,
          matched: true,
          matchType: "调料" as const,
          ingredientId: null,
          itemName: seaMatch.name,
          stockUnit: seaMatch.purchaseUnit,
          priceUnit: item.unit || seaMatch.purchaseUnit,
          storage: seaMatch.storage,
          category: "调料-未入库",
        };
      }
      // 未匹配
      return {
        ...item,
        matched: false,
        matchType: "未匹配" as const,
        ingredientId: null,
        itemName: name,
        stockUnit: item.unit || "斤",
        priceUnit: item.unit || "斤",
        storage: "常温",
        category: "未匹配",
      };
    });

    return NextResponse.json({
      items: matchedItems,
      totalAmount: recognized.totalAmount,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
