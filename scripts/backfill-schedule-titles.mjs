import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

// 把存量的门店排程标题统一覆盖成当前固定格式：
//   `门店名称 · 周二（11月21日）·菜单`
// 与 lib/shared/schedule-title.ts 的 buildScheduleTitle 保持同一口径。
//
// 用法：
//   node --env-file=.env scripts/backfill-schedule-titles.mjs           # 只预览
//   node --env-file=.env scripts/backfill-schedule-titles.mjs --apply   # 写库

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

function buildTitle(storeName, scheduleDate) {
  const weekday = WEEKDAYS[scheduleDate.getUTCDay()].replace("星期", "周");
  const month = scheduleDate.getUTCMonth() + 1;
  const day = scheduleDate.getUTCDate();
  return `${storeName} · ${weekday}（${month}月${day}日）·菜单`;
}

async function main() {
  const rows = await prisma.schedule.findMany({
    select: {
      id: true,
      title: true,
      scheduleDate: true,
      store: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  });

  const changes = rows
    .map((row) => ({
      id: row.id,
      from: row.title,
      to: buildTitle(row.store?.name ?? "未命名门店", row.scheduleDate),
    }))
    .filter((change) => change.from !== change.to);

  console.log(
    `${shouldApply ? "写入" : "预览（加 --apply 才写库）"}：${rows.length} 条排程，${changes.length} 条标题需更新`
  );
  for (const change of changes.slice(0, 50)) {
    console.log(`  #${change.id}  ${change.from}  →  ${change.to}`);
  }
  if (changes.length > 50) {
    console.log(`  ……其余 ${changes.length - 50} 条省略`);
  }

  if (shouldApply && changes.length > 0) {
    for (const change of changes) {
      await prisma.schedule.update({
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
