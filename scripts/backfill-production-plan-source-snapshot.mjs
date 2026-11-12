import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});
const shouldApply = process.argv.includes("--apply");

function buildSnapshot(schedules) {
  const stores = new Map();
  for (const schedule of schedules) {
    const store = stores.get(schedule.store.id) ?? {
      storeId: schedule.store.id,
      storeName: schedule.store.name,
      schedules: [],
    };
    store.schedules.push({
      scheduleId: schedule.id,
      code: schedule.code,
      title: schedule.title,
      scheduleDate: schedule.scheduleDate.toISOString(),
      items: schedule.items.map((item) => ({
        id: item.id,
        dishId: item.dish.id,
        dishCode: item.dish.code,
        dishName: item.dish.name,
        portion: item.dish.portion,
        meatType: item.dish.meatType,
        quantity: item.quantity,
      })),
    });
    stores.set(schedule.store.id, store);
  }

  return {
    version: 1,
    stores: [...stores.values()]
      .sort((a, b) => a.storeName.localeCompare(b.storeName, "zh"))
      .map((store) => ({
        ...store,
        schedules: [...store.schedules].sort(
          (a, b) =>
            a.scheduleDate.localeCompare(b.scheduleDate) ||
            (a.code ?? "").localeCompare(b.code ?? "", "zh")
        ),
      })),
  };
}

async function main() {
  const plans = await prisma.productionPlan.findMany({
    where: { deletedAt: null },
    orderBy: { id: "asc" },
    select: {
      id: true,
      code: true,
      sourceScheduleJson: true,
      schedules: {
        select: {
          schedule: {
            select: {
              id: true,
              code: true,
              title: true,
              scheduleDate: true,
              store: { select: { id: true, name: true } },
              items: {
                orderBy: { id: "asc" },
                select: {
                  id: true,
                  quantity: true,
                  dish: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      portion: true,
                      meatType: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const candidates = plans.filter((plan) => !plan.sourceScheduleJson);
  if (candidates.length === 0) {
    console.log("所有生产计划单均已有来源排程快照。");
    return;
  }

  console.log(`发现 ${candidates.length} 张生产计划单需要回填来源排程快照：`);
  for (const plan of candidates) {
    console.log(`- ${plan.code ?? `PPL-${plan.id}`}`);
    if (!shouldApply) continue;
    const snapshot = buildSnapshot(plan.schedules.map((reference) => reference.schedule));
    await prisma.productionPlan.update({
      where: { id: plan.id },
      data: { sourceScheduleJson: snapshot },
    });
  }

  if (!shouldApply) {
    console.log("当前为审计模式。确认后使用 --apply 执行回填。");
  } else {
    console.log(`已回填 ${candidates.length} 张生产计划单。`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
