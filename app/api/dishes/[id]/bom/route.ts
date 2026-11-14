import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";
import { dishBomSchema } from "@/lib/server/schemas/dish-bom";
import { validateBody } from "@/lib/server/validate";
import { calcOutPricePerJin } from "@/lib/shared/net-price";
import { computeCostPricePerJin, resolveRecipeLines } from "@/lib/server/sauce-utils";
import { deriveNetIngredientPrices } from "@/lib/server/net-ingredient-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dishId = Number(id);
    const body = await req.json();
    const validation = validateBody(dishBomSchema, body);
    if (!validation.success) return validation.response;

    const { netDetails, minorDetails, seasoningDetails, sauceDetails } = validation.data;

    const existing = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { status: true },
    });
    if (existing?.status === "published") {
      return NextResponse.json({ error: "已发布菜品不可修改 BOM" }, { status: 400 });
    }

    const seasoningL2Codes = await getSeasoningL2Codes();

    const totalCost = await prisma.$transaction(async (tx) => {
      await tx.dishNetDetail.deleteMany({ where: { dishId } });
      await tx.dishMinorDetail.deleteMany({ where: { dishId } });
      await tx.dishSeasoningDetail.deleteMany({ where: { dishId } });
      await tx.dishSauceDetail.deleteMany({ where: { dishId } });

      // 查询所有食材价格
      const netIngIds = (netDetails || []).map((d) => d.netIngId);
      const minorIds = (minorDetails || []).map((d) => d.netIngId);
      const seasoningIds = (seasoningDetails || []).map((d) => d.sourceId);
      const sauceIds = (sauceDetails || []).map((d) => d.sauceId);

    // 酱料成本（事务外按当前价格体系计算）：外购=每斤单价；自制=配方推算 → 统一转出库价（元/斤）
    const sauceRows = sauceIds.length > 0
      ? await prisma.sauceIngredient.findMany({
          where: { id: { in: sauceIds }, deletedAt: null },
          select: {
            id: true,
            type: true,
            pricePerJin: true,
            grossMarginRate: true,
            processingFeePerJin: true,
            recipeDetails: { select: { lineType: true, refId: true, amountG: true } },
          },
        })
      : [];

      const [netIngs, minors, seasonings] = await Promise.all([
        tx.netIngredient.findMany({
          where: { id: { in: netIngIds } },
          select: {
            id: true,
            unitPrice: true,
            yieldRate: true,
            processingFeePerJin: true,
            grossMarginRate: true,
            sourceIngredient: { select: { pricePerJin: true } },
          },
        }),
        tx.netIngredient.findMany({
          where: { id: { in: minorIds } },
          select: {
            id: true,
            unitPrice: true,
            yieldRate: true,
            processingFeePerJin: true,
            grossMarginRate: true,
            sourceIngredient: { select: { pricePerJin: true } },
          },
        }),
        tx.ingredient.findMany({
          where: { id: { in: seasoningIds }, l2Code: { in: seasoningL2Codes } },
          // 调料为标准化采购（元/瓶、元/箱），BOM 成本按每斤单价（元/斤）口径折算
          select: { id: true, pricePerJin: true },
        }),
      ]);

      // 净料与小料同口径：均按出库价计成本（成本价 = 净料单价 + 封装加工费；出库价 = 成本价 ÷ (1 - 毛利率/100)）
      const netPriceMap = new Map(
        netIngs.map((i) => {
          const prices = deriveNetIngredientPrices(i);
          return [i.id, prices.outPricePerJin] as const;
        })
      );
      const minorPriceMap = new Map(
        minors.map((i) => {
          const prices = deriveNetIngredientPrices(i);
          return [i.id, prices.outPricePerJin] as const;
        })
      );
      // 调料成本价 = 每斤单价（元/斤，由采购规格自动换算维护）；缺失时成本为 null
      const seasoningPriceMap = new Map(
        seasonings.map((i) => [i.id, i.pricePerJin != null ? Number(i.pricePerJin) : null])
      );
      // 酱料出库价（元/斤）：成本价 ÷ (1 - 毛利率/100)，空毛利率 = 成本价
      const saucePriceMap = new Map(
        await Promise.all(
          sauceRows.map(async (i) => {
            let cost: number | null;
            if (i.type === "外购") {
              cost = computeCostPricePerJin({ type: i.type, pricePerJin: i.pricePerJin });
            } else {
              const resolved = await resolveRecipeLines(
                i.recipeDetails.map((l) => ({
                  lineType: l.lineType as "net" | "seasoning",
                  refId: l.refId,
                  amountG: Number(l.amountG),
                }))
              );
              cost = computeCostPricePerJin({
                type: i.type,
                processingFeePerJin: i.processingFeePerJin,
                recipeLines: resolved.map((l) => ({ cost: l.cost, amountG: l.amountG })),
              });
            }
            return [i.id, calcOutPricePerJin(cost, i.grossMarginRate)] as const;
          })
        )
      );

      // 净料/小料成本 = 出库价(元/斤) × 用量g ÷ 500
      const calcNetCost = (netIngId: number, amountG: number) => {
        const price = netPriceMap.get(netIngId);
        return price != null ? Number((price * amountG / 500).toFixed(4)) : null;
      };
      const calcMinorCost = (netIngId: number, amountG: number) => {
        const price = minorPriceMap.get(netIngId);
        return price != null ? Number((price * amountG / 500).toFixed(4)) : null;
      };
      // 调料成本 = 每斤单价(元/斤) × 用量g ÷ 500；每斤单价缺失返回 null
      const calcSeasoningCost = (sourceId: number, amountG: number) => {
        const price = seasoningPriceMap.get(sourceId);
        return price != null ? Number((price * amountG / 500).toFixed(4)) : null;
      };
      // 酱料成本 = 出库价(元/斤) × 用量g ÷ 500
      const calcSauceCost = (sauceId: number, amountG: number) => {
        const price = saucePriceMap.get(sauceId);
        return price != null ? Number((price * amountG / 500).toFixed(4)) : null;
      };

      if (netDetails && netDetails.length > 0) {
        await tx.dishNetDetail.createMany({
          data: netDetails.map((d) => ({
            dishId,
            role: d.role || "主料",
            netIngId: Number(d.netIngId),
            amountG: Number(d.amountG),
            spec: d.spec || null,
            cost: calcNetCost(Number(d.netIngId), Number(d.amountG)),
          })),
        });
      }
      if (minorDetails && minorDetails.length > 0) {
        await tx.dishMinorDetail.createMany({
          data: minorDetails.map((d) => ({
            dishId,
            netIngId: Number(d.netIngId),
            amountG: Number(d.amountG),
            brand: d.brand || null,
            cost: calcMinorCost(Number(d.netIngId), Number(d.amountG)),
          })),
        });
      }
      if (seasoningDetails && seasoningDetails.length > 0) {
        await tx.dishSeasoningDetail.createMany({
          data: seasoningDetails.map((d) => ({
            dishId,
            type: "seasoning",
            sourceId: Number(d.sourceId),
            amountG: Number(d.amountG),
            brand: d.brand || null,
            cost: calcSeasoningCost(Number(d.sourceId), Number(d.amountG)),
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
      const [allNet, allMinor, allSea, allSau] = await Promise.all([
        tx.dishNetDetail.findMany({ where: { dishId } }),
        tx.dishMinorDetail.findMany({ where: { dishId } }),
        tx.dishSeasoningDetail.findMany({ where: { dishId } }),
        tx.dishSauceDetail.findMany({ where: { dishId } }),
      ]);

      const total =
        allNet.reduce((s, d) => s + (d.cost ? Number(d.cost) : 0), 0) +
        allMinor.reduce((s, d) => s + (d.cost ? Number(d.cost) : 0), 0) +
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
