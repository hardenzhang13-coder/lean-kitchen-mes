import "dotenv/config";
import { prisma } from "../lib/server/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

async function auditSchedule(scheduleId: number) {
  const s = await prisma.schedule.findUnique({ where: { id: scheduleId }, include: { items: true } });
  if (!s) return;
  console.log("########## 排程 " + s.id + " " + s.code + " " + s.title);
  const dishIds = s.items.map((i: { dishId: number }) => i.dishId);
  const qtyOf = new Map(s.items.map((i: { dishId: number; quantity: number }) => [i.dishId, i.quantity]));

  // 独立重算净料/小料需求
  const netBom = await prisma.dishNetDetail.findMany({ where: { dishId: { in: dishIds } }, include: { netIngredient: { select: { id: true, name: true, yieldRate: true, packageSpec: true, sourceIngredientId: true } } } });
  const minorBom = await prisma.dishMinorDetail.findMany({ where: { dishId: { in: dishIds } }, include: { netIngredient: { select: { id: true, name: true, yieldRate: true, packageSpec: true, sourceIngredientId: true } } } });

  const netNeed = new Map<number, { name: string; g: number; pkg: number | null; srcId: number | null }>();
  for (const b of netBom) {
    const q = qtyOf.get(b.dishId) ?? 0;
    const g = Number(b.amountG) * q;
    const cur = netNeed.get(b.netIngredient.id);
    if (cur) cur.g += g;
    else netNeed.set(b.netIngredient.id, { name: b.netIngredient.name, g, pkg: b.netIngredient.packageSpec != null ? Number(b.netIngredient.packageSpec) : null, srcId: b.netIngredient.sourceIngredientId });
  }
  const minorNeed = new Map<number, { name: string; g: number; pkg: number | null; srcId: number | null }>();
  for (const b of minorBom) {
    const q = qtyOf.get(b.dishId) ?? 0;
    const g = Number(b.amountG) * q;
    const cur = minorNeed.get(b.netIngredient.id);
    if (cur) cur.g += g;
    else minorNeed.set(b.netIngredient.id, { name: b.netIngredient.name, g, pkg: b.netIngredient.packageSpec != null ? Number(b.netIngredient.packageSpec) : null, srcId: b.netIngredient.sourceIngredientId });
  }

  // 切配工单比对
  const cos = await prisma.cuttingOrder.findMany({ where: { scheduleId: s.id } });
  console.log("--- 切配工单比对（库存值 vs 独立重算）");
  for (const c of cos) {
    const exp = c.sourceType === "net" ? netNeed.get(c.sourceId) : minorNeed.get(c.sourceId);
    const expG = exp ? round2(exp.g) : null;
    const gotG = round2(Number(c.requiredQty));
    const expPortions = exp && exp.pkg ? round2(exp.g / exp.pkg) : null;
    const pkg = exp ? exp.pkg : null;
    const ok = expG === gotG;
    console.log((ok ? "OK  " : "DIFF") + " [" + c.sourceType + "] " + c.itemName + " 库存=" + gotG + "g 重算=" + expG + "g 封装=" + pkg + (expPortions != null ? " 份数应=" + expPortions : ""));
    if (!ok) console.log("     ^^^ 不一致！");
  }
  // 重算有但库里没有的
  for (const [id, v] of netNeed) {
    if (!cos.some((c) => c.sourceType === "net" && c.sourceId === id)) console.log("MISS [net] " + v.name + " 重算=" + round2(v.g) + "g 库中无此行");
  }
  for (const [id, v] of minorNeed) {
    if (!cos.some((c) => c.sourceType === "minor" && c.sourceId === id)) console.log("MISS [minor] " + v.name + " 重算=" + round2(v.g) + "g 库中无此行");
  }

  // 采购计划比对（原料毛需求）
  const yieldOf = new Map<number, number>();
  for (const b of [...netBom, ...minorBom]) yieldOf.set(b.netIngredient.id, Number(b.netIngredient.yieldRate));
  const grossBySrc = new Map<number, number>();
  for (const [nid, v] of new Map([...netNeed, ...minorNeed])) {
    if (v.srcId == null) continue;
    const y = yieldOf.get(nid) || 100;
    const gross = (v.g * 100) / (y > 0 ? y : 100);
    grossBySrc.set(v.srcId, round2((grossBySrc.get(v.srcId) ?? 0) + gross));
  }
  const pps = await prisma.purchasePlan.findMany({ where: { scheduleId: s.id, sourceType: "ingredient" } });
  console.log("--- 采购计划（原料）比对");
  for (const p of pps) {
    const exp = grossBySrc.get(p.sourceId);
    const got = round2(Number(p.grossNeed));
    const ok = exp === got;
    console.log((ok ? "OK  " : "DIFF") + " " + p.itemName + " 库存毛需=" + got + "g 重算=" + exp + "g");
  }
  for (const [sid, g] of grossBySrc) {
    if (!pps.some((p) => p.sourceId === sid)) console.log("MISS 原料id=" + sid + " 重算毛需=" + g + "g 库中无此行");
  }
}

async function main() {
  await auditSchedule(9);
  await auditSchedule(7);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
