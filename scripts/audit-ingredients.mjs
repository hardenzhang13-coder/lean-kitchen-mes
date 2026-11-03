/* 一次性盘查脚本：原料清单 purchaseSpec / 价格计算链路数据质量审计（只读）
 * 内联 lib/shared/spec-parser.ts 与 unit-conversion.ts 的核心逻辑副本（保持只读，不与源码联动） */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// ---- 内联副本（与 lib/shared/spec-parser.ts / unit-conversion.ts 保持一致） ----
const GRAMS_PER_JIN = 500;
const DEFAULT_JIN_PER_UNIT = { 斤: 1, 两: 0.1, 克: 0.002, g: 0.002, 千克: 2, kg: 2, 公斤: 2 };
const PLACEHOLDER_RE = /^(散称|散装|无|—|-)$/;

function buildJinFactors(units) {
  const factors = {};
  for (const u of units) {
    const grams = Number(u.gramsPerUnit);
    if (!u.name || !Number.isFinite(grams) || grams <= 0) continue;
    factors[u.name] = grams / GRAMS_PER_JIN;
  }
  return factors;
}
function calcJinPerPurchaseUnit(spec, factors) {
  const s = (spec || "").trim();
  if (!s || PLACEHOLDER_RE.test(s)) return null;
  const table = factors ?? DEFAULT_JIN_PER_UNIT;
  const parts = s.split(/[*/\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  let jin = 1;
  let hasWeight = false;
  for (const part of parts) {
    const m = part.match(/^(\d+\.?\d*)\s*([^\d\s]*)$/);
    if (!m) continue;
    const value = Number(m[1]);
    const factor = table[m[2]];
    if (factor != null) { jin *= value * factor; hasWeight = true; }
    else jin *= value;
  }
  if (!hasWeight) return null;
  return jin > 0 ? jin : null;
}
function calcPricePerJin(refPrice, spec, factors) {
  const price = refPrice == null ? null : Number(refPrice);
  if (price == null || Number.isNaN(price) || price <= 0) return null;
  const jin = calcJinPerPurchaseUnit(spec || "", factors);
  if (jin == null) return null;
  return Math.round((price / jin) * 10000) / 10000;
}
const TRAILING_TOKEN_RE = /(\d+\.?\d*)\s*([^\d\s]+)$/;
function isHighConfidenceSpec(spec, unitNames = []) {
  const s = (spec || "").trim();
  if (!s || PLACEHOLDER_RE.test(s)) return false;
  if (!s.includes("*")) return false;
  const m = s.match(TRAILING_TOKEN_RE);
  if (!m) return false;
  return unitNames.length === 0 || unitNames.includes(m[2]);
}
function parsePurchaseSpec(spec, unitNames = []) {
  const s = (spec || "").trim();
  if (!isHighConfidenceSpec(s, unitNames)) return null;
  const tokens = [];
  const parts = s.split("*").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(\d+\.?\d*)\s*([^\d\s]+)$/);
    if (m) tokens.push({ value: Number(m[1]), unit: m[2] });
  }
  if (tokens.length === 0) return null;
  const last = tokens[tokens.length - 1];
  return { multiplier: last.value, stockUnit: last.unit, tokens };
}
// ---- 内联副本结束 ----

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const units = await prisma.unit.findMany({
  where: { isActive: true, gramsPerUnit: { not: null } },
  select: { name: true, gramsPerUnit: true },
});
const jinFactors = buildJinFactors(units);
const unitNames = (await prisma.unit.findMany({ where: { isActive: true }, select: { name: true } })).map((u) => u.name);

const ings = await prisma.ingredient.findMany({
  where: { deletedAt: null },
  select: {
    id: true, code: true, name: true, l2Code: true,
    purchaseSpec: true, purchaseUnit: true, stockUnit: true,
    latestRefPrice: true, pricePerJin: true,
  },
});

const stats = {
  total: ings.length,
  specEmpty: 0,
  specPlaceholder: 0,
  specHighConfidence: 0,
  specUnparseable: 0,
  purchaseUnitMissing: 0,
  stockUnitMissing: 0,
  refPriceMissing: 0,
  pricePerJinMissing: 0,
  pricePerJinManual: 0,
  priceMismatch: [],
  specEndsMismatchStockUnit: [],
  specUnitNotInDict: [],
  samples: { unparseable: [], highConfidence: [] },
};

for (const ing of ings) {
  const spec = (ing.purchaseSpec || "").trim();
  if (!spec) stats.specEmpty++;
  else if (PLACEHOLDER_RE.test(spec)) stats.specPlaceholder++;
  else if (isHighConfidenceSpec(spec, unitNames)) {
    stats.specHighConfidence++;
    if (stats.samples.highConfidence.length < 8) stats.samples.highConfidence.push(`${ing.code} ${spec}`);
    const parsed = parsePurchaseSpec(spec, unitNames);
    if (parsed && ing.stockUnit && parsed.stockUnit !== ing.stockUnit) {
      stats.specEndsMismatchStockUnit.push(`${ing.code} ${ing.name}: 规格尾=${parsed.stockUnit} 入库单位=${ing.stockUnit}`);
    }
  } else {
    stats.specUnparseable++;
    if (stats.samples.unparseable.length < 15) stats.samples.unparseable.push(`${ing.code} ${ing.name}: 「${spec}」 采购单位=${ing.purchaseUnit} 入库=${ing.stockUnit}`);
  }

  if (spec && !PLACEHOLDER_RE.test(spec)) {
    for (const m of spec.matchAll(/(\d+\.?\d*)\s*([^\d\s*/]+)/g)) {
      if (!unitNames.includes(m[2])) {
        stats.specUnitNotInDict.push(`${ing.code} ${ing.name}: 单位「${m[2]}」不在字典 (${spec})`);
        break;
      }
    }
  }

  if (!ing.purchaseUnit) stats.purchaseUnitMissing++;
  if (!ing.stockUnit) stats.stockUnitMissing++;
  if (ing.latestRefPrice == null) stats.refPriceMissing++;

  const jin = calcJinPerPurchaseUnit(spec, jinFactors);
  if (ing.pricePerJin == null) {
    stats.pricePerJinMissing++;
  } else if (jin == null) {
    stats.pricePerJinManual++;
  } else if (ing.latestRefPrice != null) {
    const recomputed = calcPricePerJin(Number(ing.latestRefPrice), spec, jinFactors);
    if (recomputed != null && Math.abs(recomputed - Number(ing.pricePerJin)) > 0.011) {
      stats.priceMismatch.push(`${ing.code} ${ing.name}: 存储=${ing.pricePerJin} 重算=${recomputed} (ref=${ing.latestRefPrice} spec=${spec})`);
    }
  }
}

console.log(JSON.stringify({
  ...stats,
  priceMismatch: stats.priceMismatch.slice(0, 10),
  specEndsMismatchStockUnit: stats.specEndsMismatchStockUnit.slice(0, 10),
  specUnitNotInDict: stats.specUnitNotInDict.slice(0, 15),
  jinFactorCount: Object.keys(jinFactors).length,
  jinFactors,
}, null, 2));

const inventories = await prisma.inventory.findMany({ select: { ingredientId: true, unit: true } });
const ingMap = new Map(ings.map((i) => [i.id, i]));
const unitMismatch = inventories.filter((inv) => {
  const ing = ingMap.get(inv.ingredientId);
  return ing && ing.stockUnit && inv.unit !== ing.stockUnit;
}).map((inv) => {
  const ing = ingMap.get(inv.ingredientId);
  return `${ing.code} ${ing.name}: 库存单位=${inv.unit} 食材入库单位=${ing.stockUnit}`;
});
console.log("inventory unit mismatches:", JSON.stringify(unitMismatch.slice(0, 10), null, 2));

await prisma.$disconnect();
