/**
 * 调料产物：价格派生纯函数（前后端共用）。
 *
 * 口径（2026-11-25 调味品升级）：
 * - 产物（单品调料/复合调料/成品酱料）由调味品原料转化或直接外购建档，
 *   是菜品 BOM 里调料的唯一引用对象；按克用量，行成本 = 出库价 × g ÷ 500。
 * - 成本口径 sourceMode 分支：
 *     transform（转化）：单价(元/斤) = 来源调味品每斤单价 ÷ (出成率 / 100)
 *     purchase（外购）：单价(元/斤) = 手填每斤单价（pricePerJin）
 * - 之后链路与净料完全同构，公式唯一真源在 lib/shared/net-price.ts：
 *     成本价(元/斤)     = 单价 + 封装加工费(元/斤，空 = 0)
 *     出库价(元/斤)     = 成本价 ÷ (1 − 毛利率 / 100)      // 毛利率空值按 0
 *     标准规格价(元/份) = 出库价 × 封装规格(g) ÷ 500
 */

import { isSeasoningSourceMode } from "./seasoning-product";
import { calcNetUnitPrice } from "./spec-parser";
import {
  calcCostPricePerJin,
  calcOutPricePerJin,
  calcStandardPackagePrice,
} from "./net-price";

export interface SeasoningProductPriceInput {
  sourceMode?: unknown;
  yieldRate?: unknown;
  processingFeePerJin?: unknown;
  grossMarginRate?: unknown;
  packageSpec?: unknown;
  /** 外购口径手填每斤单价 */
  pricePerJin?: unknown;
  sourceIngredient?: {
    pricePerJin?: unknown;
  } | null;
}

export interface DerivedSeasoningProductPrices {
  /** 单价（元/斤）：transform = 来源每斤单价 ÷ (出成率/100)；purchase = 手填每斤单价 */
  unitPrice: number | null;
  /** 毛利率（%）：空 = 0 */
  grossMarginRate: number;
  /** 成本价（元/斤）= 单价 + 封装加工费 */
  costPricePerJin: number | null;
  /** 出库价（元/斤）= 成本价 ÷ (1 − 毛利率/100) */
  outPricePerJin: number | null;
  /** 标准规格价（元/份）= 出库价 × 封装规格(g) ÷ 500 */
  standardPackagePrice: number | null;
}

/**
 * 产物价格链路统一入口，永远取当前价格实时派生（不信任库内 unitPrice 快照）。
 * 与 `deriveNetIngredientPrices` 同构，只是来源档案换成调味品原料或手填外购价。
 */
export function deriveSeasoningProductPrices(
  row: SeasoningProductPriceInput
): DerivedSeasoningProductPrices {
  const mode = isSeasoningSourceMode(row.sourceMode) ? row.sourceMode : "transform";

  const unitPrice =
    mode === "purchase"
      ? (() => {
          const p = Number(row.pricePerJin);
          return Number.isFinite(p) && p > 0 ? p : null;
        })()
      : calcNetUnitPrice({
          pricePerJin: row.sourceIngredient?.pricePerJin,
          yieldRate: Number(row.yieldRate),
        });

  const grossMarginRate =
    row.grossMarginRate == null || row.grossMarginRate === ""
      ? 0
      : Number(row.grossMarginRate);

  const costPrice = calcCostPricePerJin(unitPrice, row.processingFeePerJin);
  const outPrice = calcOutPricePerJin(costPrice, grossMarginRate);

  return {
    unitPrice,
    grossMarginRate: Number.isFinite(grossMarginRate) ? grossMarginRate : 0,
    costPricePerJin: costPrice,
    outPricePerJin: outPrice,
    standardPackagePrice:
      outPrice != null
        ? calcStandardPackagePrice(outPrice, row.packageSpec)
        : null,
  };
}
