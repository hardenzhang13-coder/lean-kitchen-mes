import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getSeasoningL2Codes } from "@/lib/category-helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dishId = Number(id);
  const body = await req.json();
  const {
    netDetails,
    seasoningDetails,
    sauceDetails,
  }: {
    netDetails?: Array<{
      role: string;
      netIngId: number;
      amountG: number;
      spec?: string;
    }>;
    seasoningDetails?: Array<{
      type: string;
      sourceId: number;
      amountG: number;
      brand?: string;
    }>;
    sauceDetails?: Array<{
      sauceId: number;
      amountG: number;
      brand?: string;
    }>;
  } = body;

  try {
    const seasoningL2Codes = await getSeasoningL2Codes();

    const totalCost = await prisma.$transaction(async (tx) => {
      await tx.dishNetDetail.deleteMany({ where: { dishId } });
      await tx.dishSeasoningDetail.deleteMany({ where: { dishId } });
      await tx.dishSauceDetail.deleteMany({ where: { dishId } });

      // 查询所有食材价格
      const netIngIds = (netDetails || []).map((d) => d.netIngId);
      const minorIds = (seasoningDetails || []).filter((d) => d.type === "minor").map((d) => d.sourceId);
      const seasoningIds = (seasoningDetails || []).filter((d) => d.type === "seasoning").map((d) => d.sourceId);
      const sauceIds = (sauceDetails || []).map((d) => d.sauceId);

      const [netIngs, minors, seasonings, sauces] = await Promise.all([
        tx.netIngredient.findMany({ where: { id: { in: netIngIds } }, select: { id: true, unitPrice: true } }),
        tx.minorIngredient.findMany({ where: { id: { in: minorIds } }, select: { id: true, unitPrice: true } }),
        tx.ingredient.findMany({
          where: { id: { in: seasoningIds }, l2Code: { in: seasoningL2Codes } },
          select: { id: true, latestRefPrice: true },
        }),
        tx.sauceIngredient.findMany({ where: { id: { in: sauceIds } }, select: { id: true, unitPrice: true } }),
      ]);

      const netPriceMap = new Map(netIngs.map((i) => [i.id, Number(i.unitPrice)]));
      const minorPriceMap = new Map(minors.map((i) => [i.id, Number(i.unitPrice)]));
      const seasoningPriceMap = new Map(seasonings.map((i) => [i.id, Number(i.latestRefPrice ?? 0)]));
      const saucePriceMap = new Map(sauces.map((i) => [i.id, Number(i.unitPrice)]));

      // 计算 cost = 单价 × amountG / 1000
      const calcNetCost = (netIngId: number, amountG: number) => {
        const price = netPriceMap.get(netIngId);
        return price != null ? Number((price * amountG / 1000).toFixed(4)) : null;
      };
      const calcSeasoningCost = (type: string, sourceId: number, amountG: number) => {
        const price = type === "minor" ? minorPriceMap.get(sourceId) : seasoningPriceMap.get(sourceId);
        return price != null ? Number((price * amountG / 1000).toFixed(4)) : null;
      };
      const calcSauceCost = (sauceId: number, amountG: number) => {
        const price = saucePriceMap.get(sauceId);
        return price != null ? Number((price * amountG / 1000).toFixed(4)) : null;
      };

      if (netDetails && netDetails.length > 0) {
        await tx.dishNetDetail.createMany({
          data: netDetails.map((d) => ({
            dishId,
            role: d.role,
            netIngId: Number(d.netIngId),
            amountG: Number(d.amountG),
            spec: d.spec || null,
            cost: calcNetCost(Number(d.netIngId), Number(d.amountG)),
          })),
        });
      }
      if (seasoningDetails && seasoningDetails.length > 0) {
        await tx.dishSeasoningDetail.createMany({
          data: seasoningDetails.map((d) => ({
            dishId,
            type: d.type,
            sourceId: Number(d.sourceId),
            amountG: Number(d.amountG),
            brand: d.brand || null,
            cost: calcSeasoningCost(d.type, Number(d.sourceId), Number(d.amountG)),
          })),
        });
      }
      if (sauceDetails && sauceDetails.length > 0) {
        await tx.dishSauceDetail.createMany({
          data: sauceDetails.map((d) => ({
            dishId,
            sauceId: Number(d.sauceId),
            amountG: Number(d.amountG),
            brand: d.brand || null,
            cost: calcSauceCost(Number(d.sauceId), Number(d.amountG)),
          })),
        });
      }

      // 重新计算菜品总成本
      const [allNet, allSea, allSau] = await Promise.all([
        tx.dishNetDetail.findMany({ where: { dishId } }),
        tx.dishSeasoningDetail.findMany({ where: { dishId } }),
        tx.dishSauceDetail.findMany({ where: { dishId } }),
      ]);

      const total =
        allNet.reduce((s, d) => s + (d.cost ? Number(d.cost) : 0), 0) +
        allSea.reduce((s, d) => s + (d.cost ? Number(d.cost) : 0), 0) +
        allSau.reduce((s, d) => s + (d.cost ? Number(d.cost) : 0), 0);

      await tx.dish.update({
        where: { id: dishId },
        data: { cost: Number(total.toFixed(4)) },
      });

      return total;
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "DishBOM",
      entityId: dishId,
      description: `更新菜品 BOM`,
    });

    return NextResponse.json({ success: true, cost: totalCost });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
