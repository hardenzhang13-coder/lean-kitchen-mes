/**
 * 调料标准化规格：价格派生纯函数（前后端共用）。
 *
 * 口径（2026-11 调料标准化）：
 * - 标准化规格由「调料采购档案」转化而来，是菜品 BOM 里调料的唯一引用对象。
 * - 标准规格统一以 g 计，不引入瓶/袋等单位；包装形态信息保留在来源调料的采购规格上，仅作对照展示。
 * - 名称沿用来源调料名（不拼规格后缀），规格差异由「包装规格」列区分。
 * - 价格链路与净料完全同构，公式唯一真源在 lib/shared/net-price.ts 与 lib/shared/spec-parser.ts：
 *     单价(元/斤)       = 来源调料每斤单价 ÷ (出成率 / 100)
 *     成本价(元/斤)     = 单价 + 封装加工费(元/斤，空 = 0)
 *     出库价(元/斤)     = 成本价 ÷ (1 − 毛利率 / 100)      // 毛利率空值按 0
 *     标准规格价(元/份) = 出库价 × 标准规格(g) ÷ 500
 */

import { calcNetUnitPrice } from "./spec-parser";
import {
  calcCostPricePerJin,
  calcOutPricePerJin,
  calcStandardPackagePrice,
} from "./net-price";

export interface StandardSeasoningPriceInput {
  yieldRate?: unknown;
  processingFeePerJin?: unknown;
  grossMarginRate?: unknown;
  packageSpec?: unknown;
  sourceIngredient?: {
    pricePerJin?: unknown;
  } | null;
}

export interface DerivedStandardSeasoningPrices {
  /** 单价（元/斤）：来源调料每斤单价 ÷ (出成率/100) */
  unitPrice: number | null;
  /** 毛利率（%）：空 = 0 */
  grossMarginRate: number;
  /** 成本价（元/斤）= 单价 + 封装加工费 */
  costPricePerJin: number | null;
  /** 出库价（元/斤）= 成本价 ÷ (1 − 毛利率/100) */
  outPricePerJin: number | null;
  /** 标准规格价（元/份）= 出库价 × 标准规格(g) ÷ 500 */
  standardPackagePrice: number | null;
}

/**
 * 标准化规格价格链路统一入口：单价永远取当前来源调料价格。
 * 与 `deriveNetIngredientPrices` 同构，只是来源档案从原料换成调料。
 */
export function deriveStandardSeasoningPrices(
  row: StandardSeasoningPriceInput
): DerivedStandardSeasoningPrices {
  const unitPrice = calcNetUnitPrice({
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
