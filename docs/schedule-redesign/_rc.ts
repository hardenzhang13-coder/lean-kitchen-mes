import "dotenv/config";
import { prisma } from "../../lib/server/prisma";
import { buildCuttingOrders, buildPurchasePlans } from "../../lib/server/schedule-utils";
import { getSeasoningL2Codes } from "../../lib/server/category-helpers";

async function main() {
  const id = 1;
  const schedule = await prisma.schedule.findUnique({ where: { id }, include: { items: true } });
  if (!schedule) { console.log("not found"); return; }
  const items = schedule.items.map((it) => ({ dishId: it.dishId, quantity: it.quantity }));
  await prisma.$transaction(async (tx) => {
    await tx.cuttingOrder.deleteMany({ where: { scheduleId: id } });
    await tx.purchasePlan.deleteMany({ where: { scheduleId: id } });
    const cutting = await buildCuttingOrders(tx, id, items);
    for (const c of cutting) await tx.cuttingOrder.create({ data: c });
    const codes = await getSeasoningL2Codes();
    const plans = await buildPurchasePlans(tx, id, items, codes);
    for (const p of plans) await tx.purchasePlan.create({ data: p });
  });
  const cos = await prisma.cuttingOrder.findMany({ where: { scheduleId: id } });
  console.log("=== 重算后切配工单");
  for (const c of cos) console.log(JSON.stringify({ 名称: c.itemName, 规格: c.spec, 切配量g: Number(c.requiredQty), 份数: null }));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
