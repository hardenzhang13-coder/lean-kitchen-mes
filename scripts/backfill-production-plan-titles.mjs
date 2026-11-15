import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

// 把存量的生产计划单标题统一覆盖成当前固定格式：
//   `切配中心·周二（11月21日）生产计划`
// 与 lib/shared/production-plan-title.ts 的 buildProductionPlanTitle 保持同一口径。
//
// 用法：
//   node --env-file=.env scripts/backfill-production-plan-titles.mjs           # 只预览
//   node --env-file=.env scripts/backfill-production-plan-titles.mjs --apply   # 写库

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});
const shouldApply = process.argv.includes("--apply");

const WEEKDAYS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
];

function buildTitle(planDate) {
  const weekday = WEEKDAYS[planDate.getUTCDay()].replace("星期", "周");
  const month = planDate.getUTCMonth() + 1;
  const day = planDate.getUTCDate();
  return `切配中心·${weekday}（${month}月${day}日）生产计划`;
}

async function main() {
  const rows = await prisma.productionPlan.findMany({
    select: { id: true, title: true, planDate: true, deletedAt: true },
    orderBy: { id: "asc" },
  });

  const changes = rows
    .map((row) => ({
      id: row.id,
      from: row.title,
      to: buildTitle(row.planDate),
    }))
    .filter((change) => change.from !== change.to);

  console.log(
    `${shouldApply ? "写入" : "预览（加 --apply 才写库）"}：${rows.length} 张计划单，${changes.length} 条标题需更新`
  );
  for (const change of changes) {
    console.log(`  #${change.id}  ${change.from}  →  ${change.to}`);
  }

  if (shouldApply && changes.length > 0) {
    for (const change of changes) {
      await prisma.productionPlan.update({
        where: { id: change.id },
        data: { title: change.to },
      });
    }
    console.log(`已更新 ${changes.length} 条`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
