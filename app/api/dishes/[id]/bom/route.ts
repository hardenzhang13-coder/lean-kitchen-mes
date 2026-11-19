import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";
import { dishBomSchema } from "@/lib/server/schemas/dish-bom";
import { validateBody } from "@/lib/server/validate";
import { calcOutPricePerJin } from "@/lib/shared/net-price";
import { computeCostPricePerJin, resolveRecipeLines } from "@/lib/server/sauce-utils";
import { deriveNetIngredientPrices } from "@/lib/server/net-ingredient-utils";
import { resolveNetBomAmountG, resolvePackageSpecAmountG } from "@/lib/shared/bom-amount";
import { deriveStandardSeasoningPrices } from "@/lib/shared/seasoning-spec";

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
    if (existing && existing.status !== "draft") {
      return NextResponse.json(
        { error: "已发布或已停用菜品不可修改 BOM，请先下架为草稿" },
        { status: 400 }
      );
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
      const seasoningIds = (seasoningDetails || [])
        .map((d) => Number(d.sourceId))
        .filter((id) => Number.isFinite(id) && id > 0);
      const seasoningSpecIds = [
        ...new Set(
          (seasoningDetails || [])
            .map((d) => (d.specId != null ? Number(d.specId) : null))
            .filter((id): id is number => id != null)
        ),
      ];
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

      const [netIngs, minors, seasonings, standardSeasonings] = await Promise.all([
        tx.netIngredient.findMany({
          where: { id: { in: netIngIds }, deletedAt: null },
          select: {
            id: true,
            name: true,
            l2Code: true,
            packageSpec: true,
            unitPrice: true,
            yieldRate: true,
            processingFeePerJin: true,
            grossMarginRate: true,
            sourceIngredient: { select: { pricePerJin: true } },
          },
        }),
        tx.netIngredient.findMany({
          where: { id: { in: minorIds }, deletedAt: null },
          select: {
            id: true,
            name: true,
            l2Code: true,
            packageSpec: true,
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
        tx.standardSeasoning.findMany({
          where: { id: { in: seasoningSpecIds }, deletedAt: null },
          select: {
            id: true,
            name: true,
            packageSpec: true,
            portion: true,
            yieldRate: true,
            processingFeePerJin: true,
            grossMarginRate: true,
            sourceIngredientId: true,
            sourceIngredient: { select: { pricePerJin: true } },
          },
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

      // 净料/小料的 BOM 用量以档案封装规格为唯一真源；同时校验引用与分类，防止客户端伪造
      const netById = new Map(netIngs.map((i) => [i.id, i]));
      const minorById = new Map(minors.map((i) => [i.id, i]));
      const l2Codes = [
        ...new Set(
          [...netIngs, ...minors]
            .map((i) => i.l2Code)
            .filter((code): code is string => !!code)
        ),
      ];
      const l2Rows =
        l2Codes.length > 0
          ? await tx.ingredientCategoryL2.findMany({
              where: { code: { in: l2Codes } },
              select: { code: true, parentCode: true },
            })
          : [];
      const parentByL2 = new Map(l2Rows.map((row) => [row.code, row.parentCode]));

      for (const detail of netDetails ?? []) {
        const net = netById.get(Number(detail.netIngId));
        if (!net) throw new Error(`净料不存在或已删除（ID ${detail.netIngId}）`);
        if (parentByL2.get(net.l2Code ?? "") === "MIN") {
          throw new Error(`${net.name} 属于小料分类，不能加入主料/辅料`);
        }
      }
      for (const detail of minorDetails ?? []) {
        const minor = minorById.get(Number(detail.netIngId));
        if (!minor) throw new Error(`小料不存在或已删除（ID ${detail.netIngId}）`);
        if (parentByL2.get(minor.l2Code ?? "") !== "MIN") {
          throw new Error(`${minor.name} 不是小料分类，不能加入小料`);
        }
      }

      const netPackageSpecMap = new Map(netIngs.map((i) => [i.id, i.packageSpec]));
      const minorPackageSpecMap = new Map(minors.map((i) => [i.id, i.packageSpec]));
      // 调料成本价 = 每斤单价（元/斤，由采购规格自动换算维护）；缺失时成本为 null
      const seasoningPriceMap = new Map(
        seasonings.map((i) => [i.id, i.pricePerJin != null ? Number(i.pricePerJin) : null])
      );
      // 标准化调料：出库价（元/斤）与标准规格（g），BOM 用量强制等于标准规格
      const standardSpecMap = new Map(
        standardSeasonings.map((spec) => {
          const prices = deriveStandardSeasoningPrices(spec);
          return [
            spec.id,
            {
              id: spec.id,
              name: spec.name,
              packageSpec: spec.packageSpec,
              portion: spec.portion,
              sourceIngredientId: spec.sourceIngredientId,
              outPricePerJin: prices.outPricePerJin,
            },
          ] as const;
        })
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
      // 标准化调料成本 = 出库价(元/斤) × 标准规格g ÷ 500
      const calcStandardSeasoningCost = (outPricePerJin: number | null, amountG: number) => {
        return outPricePerJin != null
          ? Number((outPricePerJin * amountG / 500).toFixed(4))
          : null;
      };
      // 酱料成本 = 出库价(元/斤) × 用量g ÷ 500
      const calcSauceCost = (sauceId: number, amountG: number) => {
        const price = saucePriceMap.get(sauceId);
        return price != null ? Number((price * amountG / 500).toFixed(4)) : null;
      };

      if (netDetails && netDetails.length > 0) {
        await tx.dishNetDetail.createMany({
          data: netDetails.map((d) => {
            const netIngId = Number(d.netIngId);
            const pkg = netPackageSpecMap.get(netIngId);
            const amountG = resolveNetBomAmountG(d.amountG, pkg);
            return {
              dishId,
              role: d.role || "主料",
              netIngId,
              amountG,
              spec: pkg != null ? `${pkg}g` : d.spec || null,
              cost: calcNetCost(netIngId, amountG),
            };
          }),
        });
      }
      if (minorDetails && minorDetails.length > 0) {
        await tx.dishMinorDetail.createMany({
          data: minorDetails.map((d) => {
            const netIngId = Number(d.netIngId);
            const pkg = minorPackageSpecMap.get(netIngId);
            const amountG = resolveNetBomAmountG(d.amountG, pkg);
            return {
              dishId,
              netIngId,
              amountG,
              brand: d.brand || null,
              cost: calcMinorCost(netIngId, amountG),
            };
          }),
        });
      }
      if (seasoningDetails && seasoningDetails.length > 0) {
        await tx.dishSeasoningDetail.createMany({
          data: seasoningDetails.map((d) => {
            const specId = d.specId != null ? Number(d.specId) : null;
            if (specId != null) {
              const spec = standardSpecMap.get(specId);
              if (!spec) {
                throw new Error(`标准化调料不存在或已删除（ID ${specId}）`);
              }
              // 用量强制等于标准规格（唯一真源），成本按出库价折算
              const amountG = resolvePackageSpecAmountG(d.amountG, spec.packageSpec);
              return {
                dishId,
                type: "seasoning",
                sourceId: spec.sourceIngredientId,
                specId,
                amountG,
                brand: d.brand || null,
                cost: calcStandardSeasoningCost(spec.outPricePerJin, amountG),
              };
            }
            // 存量旧口径行：直接引用采购调料，用量与成本沿用原口径
            const sourceId = Number(d.sourceId);
            if (!Number.isFinite(sourceId) || sourceId <= 0) {
              throw new Error("调料行缺少来源调料或标准化规格");
            }
            const amountG = Number(d.amountG);
            if (!Number.isFinite(amountG) || amountG <= 0) {
              throw new Error("调料行缺少用量");
            }
            return {
              dishId,
              type: "seasoning",
              sourceId,
              specId: null,
              amountG,
              brand: d.brand || null,
              cost: calcSeasoningCost(sourceId, amountG),
            };
          }),
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
