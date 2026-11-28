/**
 * 一次性把菜品 BOM 的净料/小料用量对齐到当前封装规格，并重建未完成单据。
 *
 * 用法：
 *   node --env-file=.env --import tsx scripts/align-dish-bom-package-spec.ts
 *   node --env-file=.env --import tsx scripts/align-dish-bom-package-spec.ts --apply
 *   node --env-file=.env --import tsx scripts/align-dish-bom-package-spec.ts --apply --audit-out scripts/out/align.json
 *
 * 默认只预览；--apply 才写库。执行前请先做相关表的定向备份。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "@/lib/server/prisma";
import { syncBomAmountsForNetIngredient } from "@/lib/server/bom-package-sync";
import { recalcIncompleteDocumentsForNetIngredient } from "@/lib/server/incomplete-document-recalc";

interface MismatchRow {
  rowId: number;
  dishId: number;
  dishCode: string | null;
  dishName: string;
  netId: number;
  netName: string;
  packageSpec: number;
  amountG: string | number;
  table: "net" | "minor";
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const auditIndex = args.indexOf("--audit-out");
const auditPath =
  auditIndex >= 0 && args[auditIndex + 1]
    ? args[auditIndex + 1]
    : `scripts/out/dish-bom-align-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function loadMismatches(): Promise<MismatchRow[]> {
  // 小料行已并入 dish_net_details（role='minor'），单表查询即可覆盖
  const netRows = await prisma.$queryRaw<MismatchRow[]>`
    SELECT dnd.id AS rowId, dnd.dish_id AS dishId, d.code AS dishCode, d.name AS dishName,
           ni.id AS netId, ni.name AS netName, ni.package_spec AS packageSpec,
           dnd.amount_g AS amountG, 'net' AS \`table\`
    FROM dish_net_details dnd
    JOIN net_ingredients ni ON ni.id = dnd.net_ing_id
    JOIN dishes d ON d.id = dnd.dish_id
    WHERE ni.package_spec IS NOT NULL AND ABS(dnd.amount_g - ni.package_spec) > 0.001
  `;
  return netRows;
}

async function captureAudit(mismatches: MismatchRow[]) {
  const dishIds = [...new Set(mismatches.map((row) => row.dishId))];
  const netIds = [...new Set(mismatches.map((row) => row.netId))];

  const [bomNetRows, dishCosts, selfItems] = await Promise.all([
    prisma.dishNetDetail.findMany({
      where: { id: { in: mismatches.map((r) => r.rowId) } },
    }),
    prisma.dish.findMany({
      where: { id: { in: dishIds } },
      select: { id: true, cost: true },
    }),
    prisma.selfProductionItem.findMany({
      where: { sourceId: { in: netIds } },
      select: { orderId: true },
    }),
  ]);

  const schedules = await prisma.schedule.findMany({
    where: {
      status: { in: ["待生效", "进行中"] },
      items: { some: { dishId: { in: dishIds } } },
    },
    select: { id: true, code: true },
  });
  const scheduleIds = schedules.map((row) => row.id);
  const selfOrderIds = [...new Set(selfItems.map((item) => item.orderId))];

  const planOr = [
    ...(scheduleIds.length
      ? [{ schedules: { some: { scheduleId: { in: scheduleIds } } } }]
      : []),
    ...(selfOrderIds.length
      ? [{ selfOrders: { some: { selfOrderId: { in: selfOrderIds } } } }]
      : []),
  ];

  const [cuttingOrders, purchasePlans, plans] = await Promise.all([
    scheduleIds.length
      ? prisma.cuttingOrder.findMany({ where: { scheduleId: { in: scheduleIds } } })
      : [],
    scheduleIds.length
      ? prisma.purchasePlan.findMany({ where: { scheduleId: { in: scheduleIds } } })
      : [],
    planOr.length
      ? prisma.productionPlan.findMany({
          where: {
            deletedAt: null,
            status: { in: ["待生效", "进行中"] },
            OR: planOr,
          },
          select: {
            id: true,
            code: true,
            cuttingJson: true,
            purchaseJson: true,
            sourceScheduleJson: true,
          },
        })
      : [],
  ]);

  return {
    createdAt: new Date().toISOString(),
    mismatches,
    bomNetRows,
    dishCosts,
    schedules,
    cuttingOrders,
    purchasePlans,
    plans,
  };
}

async function main() {
  const mismatches = await loadMismatches();

  if (mismatches.length === 0) {
    console.log("BOM 用量与封装规格已一致，无需处理。");
    return;
  }

  const grouped = new Map<number, number>();
  for (const row of mismatches) {
    grouped.set(row.netId, num(row.packageSpec));
  }

  console.log(`发现 ${mismatches.length} 行不一致，涉及 ${grouped.size} 个净料/小料：`);
  for (const row of mismatches) {
    console.log(
      `  [${row.table}] 菜品 ${row.dishCode ?? row.dishId} ${row.dishName} / ` +
        `${row.netName}（#${row.netId}）：amount_g ${num(row.amountG)} → ${num(row.packageSpec)}`
    );
  }

  if (!apply) {
    console.log("\n预览模式：未写库。加 --apply 执行对齐。");
    return;
  }

  const audit = await captureAudit(mismatches);
  mkdirSync(dirname(auditPath), { recursive: true });
  writeFileSync(auditPath, JSON.stringify(audit, null, 2));
  console.log(`\n审计文件已写入：${auditPath}`);

  await prisma.$transaction(
    async (tx) => {
      for (const [netId, packageSpec] of grouped) {
        await syncBomAmountsForNetIngredient(tx, netId, packageSpec);
        await recalcIncompleteDocumentsForNetIngredient(tx, netId);
      }
    },
    { timeout: 120_000, maxWait: 10_000 }
  );

  console.log("\n对齐完成：BOM 用量、菜品成本、未完成排程与生产计划已按当前封装规格重建。");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
