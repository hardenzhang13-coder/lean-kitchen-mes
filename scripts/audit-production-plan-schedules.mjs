import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});
const shouldApply = process.argv.includes("--apply");

async function main() {
  const plans = await prisma.productionPlan.findMany({
    where: { status: "已完成", deletedAt: null },
    orderBy: { id: "asc" },
    select: {
      id: true,
      code: true,
      schedules: {
        select: {
          schedule: {
            select: {
              id: true,
              code: true,
              status: true,
              cuttingOrders: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  const candidates = new Map();
  for (const plan of plans) {
    for (const reference of plan.schedules) {
      const schedule = reference.schedule;
      const pending = schedule.cuttingOrders.filter(
        (order) => order.status === "pending"
      ).length;
      if (schedule.status !== "进行中" || pending > 0 || schedule.cuttingOrders.length === 0) {
        continue;
      }
      const current = candidates.get(schedule.id);
      if (current) {
        current.planCodes.push(plan.code ?? `PPL-${plan.id}`);
      } else {
        candidates.set(schedule.id, {
          code: schedule.code,
          planCodes: [plan.code ?? `PPL-${plan.id}`],
        });
      }
    }
  }

  if (candidates.size === 0) {
    console.log("未发现“来源生产计划已完成、门店排程仍为进行中”的异常数据。");
    return;
  }

  console.log(`发现 ${candidates.size} 张待修复排程：`);
  for (const [scheduleId, row] of candidates) {
    console.log(
      `- schedule=${scheduleId} code=${row.code ?? "—"} plans=${row.planCodes.join(",")}`
    );
  }

  if (!shouldApply) {
    console.log("当前为审计模式。确认后使用 --apply 执行状态修复。");
    return;
  }

  const result = await prisma.schedule.updateMany({
    where: { id: { in: [...candidates.keys()] }, status: "进行中" },
    data: { status: "已完成" },
  });
  console.log(`已修复 ${result.count} 张门店排程状态。`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
