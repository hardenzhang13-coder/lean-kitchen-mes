// 净菜库存核心服务：库存变动（入库 / 出库 / 作废回滚）+ 台账双单位流水。
// 所有函数必须在 prisma.$transaction 内调用；并发出库用条件更新防并发超发。

import type { Prisma } from "@prisma/client";
import { round2 } from "@/lib/shared/prepped-stock";

export type StockChangeType = "stock_in" | "stock_out" | "stock_rollback";
export type StockBizType = "production_complete" | "outbound" | "outbound_void";

export interface StockChangeItem {
  sourceType: string; // net / minor
  sourceId: number;
  itemCode?: string | null;
  itemName: string;
  l1Name?: string | null;
  l2Name?: string | null;
  /** 变动份数（正数；方向由 changeType 决定） */
  portions: number;
  /** 变动克重（正数；调用方按当时封装规格换算） */
  qtyG: number;
  /** 生产批次入库时快照封装规格；出库/回滚不需要传 */
  batchPackageSpec?: number | null;
  /** 生产批次入库时的计划份数；缺省按实际入库份数记录 */
  batchPlannedPortions?: number | null;
}

export interface StockChangeContext {
  tx: Prisma.TransactionClient;
  changeType: StockChangeType;
  bizType: StockBizType;
  bizId?: number | null;
  bizRefCode?: string | null;
  scheduleId?: number | null;
  storeId?: number | null;
  /** 生产批次 ID；传入后库存变动会同步维护批次余量 */
  productionPlanId?: number | null;
  operator?: string | null;
}

/**
 * 净菜库存变动：更新 prepped_stock（份+g 双单位）并写台账。
 * stock_out 使用条件更新（current_portions >= 出库份数），影响行数为 0 抛错防并发超发。
 */
export async function applyStockChange(ctx: StockChangeContext, item: StockChangeItem): Promise<void> {
  const portions = round2(item.portions);
  const qtyG = round2(item.qtyG);
  if (!(portions > 0) || !(qtyG > 0)) throw new Error(`净菜 ${item.itemName} 变动量必须为正数`);

  let balancePortions: number;
  let balanceQty: number;

  const batchPlanId = ctx.productionPlanId;

  if (ctx.changeType === "stock_out") {
    if (batchPlanId != null) {
      const batchUpdated = await ctx.tx.preppedStockBatch.updateMany({
        where: {
          productionPlanId: batchPlanId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          currentPortions: { gte: portions },
          currentQty: { gte: qtyG },
        },
        data: {
          currentPortions: { decrement: portions },
          currentQty: { decrement: qtyG },
        },
      });
      if (batchUpdated.count === 0) {
        throw new Error(`净菜 ${item.itemName} 生产批次余量不足（需出库 ${portions} 份），请刷新批次`);
      }
    }

    const updated = await ctx.tx.preppedStock.updateMany({
      where: { sourceType: item.sourceType, sourceId: item.sourceId, currentPortions: { gte: portions } },
      data: {
        currentPortions: { decrement: portions },
        currentQty: { decrement: qtyG },
      },
    });
    if (updated.count === 0) {
      throw new Error(`净菜 ${item.itemName} 库存份数不足（需出库 ${portions} 份），库存已变化请刷新`);
    }
    const row = await ctx.tx.preppedStock.findUnique({
      where: { sourceType_sourceId: { sourceType: item.sourceType, sourceId: item.sourceId } },
      select: { currentPortions: true, currentQty: true },
    });
    balancePortions = round2(Number(row?.currentPortions ?? 0));
    balanceQty = round2(Number(row?.currentQty ?? 0));
  } else if (ctx.changeType === "stock_rollback") {
    if (batchPlanId != null) {
      const batchUpdated = await ctx.tx.preppedStockBatch.updateMany({
        where: {
          productionPlanId: batchPlanId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
        },
        data: {
          currentPortions: { increment: portions },
          currentQty: { increment: qtyG },
        },
      });
      if (batchUpdated.count === 0) {
        throw new Error(`净菜 ${item.itemName} 生产批次行不存在，无法回滚`);
      }
    }

    const row = await ctx.tx.preppedStock.upsert({
      where: { sourceType_sourceId: { sourceType: item.sourceType, sourceId: item.sourceId } },
      create: {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        currentPortions: portions,
        currentQty: qtyG,
      },
      update: {
        currentPortions: { increment: portions },
        currentQty: { increment: qtyG },
      },
    });
    balancePortions = round2(Number(row.currentPortions));
    balanceQty = round2(Number(row.currentQty));
  } else {
    const row = await ctx.tx.preppedStock.upsert({
      where: { sourceType_sourceId: { sourceType: item.sourceType, sourceId: item.sourceId } },
      create: {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        currentPortions: portions,
        currentQty: qtyG,
      },
      update: {
        currentPortions: { increment: portions },
        currentQty: { increment: qtyG },
      },
    });
    balancePortions = round2(Number(row.currentPortions));
    balanceQty = round2(Number(row.currentQty));

    if (batchPlanId != null) {
      const planned = round2(item.batchPlannedPortions ?? portions);
      await ctx.tx.preppedStockBatch.upsert({
        where: {
          productionPlanId_sourceType_sourceId: {
            productionPlanId: batchPlanId,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
          },
        },
        create: {
          productionPlanId: batchPlanId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          packageSpec: item.batchPackageSpec ?? null,
          plannedPortions: planned,
          producedPortions: portions,
          currentPortions: portions,
          currentQty: qtyG,
        },
        update: {
          producedPortions: { increment: portions },
          currentPortions: { increment: portions },
          currentQty: { increment: qtyG },
        },
      });
    }
  }

  await ctx.tx.preppedStockLedger.create({
    data: {
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      changeType: ctx.changeType,
      changePortions: portions,
      changeQty: qtyG,
      balancePortions,
      balanceQty,
      bizType: ctx.bizType,
      bizId: ctx.bizId ?? null,
      bizRefCode: ctx.bizRefCode ?? null,
      scheduleId: ctx.scheduleId ?? null,
      storeId: ctx.storeId ?? null,
      itemCode: item.itemCode ?? null,
      itemName: item.itemName,
      l1Name: item.l1Name ?? null,
      l2Name: item.l2Name ?? null,
      operator: ctx.operator ?? null,
    },
  });
}

/** 批量变动（同一事务上下文） */
export async function applyStockChanges(ctx: StockChangeContext, items: StockChangeItem[]): Promise<void> {
  for (const item of items) {
    await applyStockChange(ctx, item);
  }
}