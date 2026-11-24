import type { Prisma } from "@prisma/client";
import {
  lockSchedulesForProductionPlan,
  lockSelfOrdersForProductionPlan,
  nextProductionPlanCode,
  syncSourceScheduleStatuses,
  syncSourceSelfOrderStatuses,
} from "../production-plan-assignment";

describe("nextProductionPlanCode", () => {
  it("按创建时刻生成 PPL-年月日-时分", async () => {
    const count = jest.fn().mockResolvedValue(0);
    const tx = {
      productionPlan: { count },
    } as unknown as Prisma.TransactionClient;

    const code = await nextProductionPlanCode(tx);

    expect(code).toMatch(/^PPL-\d{8}-\d{4}$/);
    expect(count).toHaveBeenCalledWith({
      where: { code: { startsWith: code } },
    });
  });

  it("同分钟冲突时追加 -2、-3 后缀", async () => {
    const count = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const tx = {
      productionPlan: { count },
    } as unknown as Prisma.TransactionClient;

    const first = await nextProductionPlanCode(tx);
    const second = await nextProductionPlanCode(tx);

    expect(first).toMatch(/^PPL-\d{8}-\d{4}-2$/);
    expect(second).toMatch(/^PPL-\d{8}-\d{4}-3$/);
    expect(second.startsWith(first.slice(0, -2))).toBe(true);
  });
});

function createTx(orders: Array<{ scheduleId: number; status: string }>) {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = {
    cuttingOrder: {
      findMany: jest.fn().mockResolvedValue(orders),
    },
    schedule: {
      updateMany,
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, updateMany };
}

describe("syncSourceScheduleStatuses", () => {
  it("生产计划完成不回写来源排程；排程完成改由出库单触发", async () => {
    const { tx, updateMany } = createTx([
      { scheduleId: 1, status: "completed" },
      { scheduleId: 1, status: "unfinished" },
      { scheduleId: 2, status: "completed" },
    ]);

    const completed = await syncSourceScheduleStatuses(tx, [1, 2], true);

    expect(completed).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("生产计划未完成时也不更新来源排程", async () => {
    const { tx, updateMany } = createTx([
      { scheduleId: 3, status: "completed" },
      { scheduleId: 4, status: "pending" },
    ]);

    const completed = await syncSourceScheduleStatuses(tx, [3, 4], false);

    expect(completed).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("syncSourceSelfOrderStatuses", () => {
  it("计划完成时把进行中的来源内部生产单置为已完成", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const tx = {
      selfProductionOrder: { updateMany },
    } as unknown as Prisma.TransactionClient;

    const completed = await syncSourceSelfOrderStatuses(tx, [5, 6], true);

    expect(completed).toEqual([5, 6]);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: [5, 6] }, status: "进行中" },
      data: { status: "已完成" },
    });
  });

  it("计划未完成时不更新内部生产单", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      selfProductionOrder: { updateMany },
    } as unknown as Prisma.TransactionClient;

    const completed = await syncSourceSelfOrderStatuses(tx, [5], false);

    expect(completed).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("lockSchedulesForProductionPlan", () => {
  it("空数组直接放行（纯手工切配计划）", async () => {
    const tx = {} as unknown as Prisma.TransactionClient;
    await expect(lockSchedulesForProductionPlan(tx, [])).resolves.toEqual([]);
  });
});

describe("lockSelfOrdersForProductionPlan", () => {
  it("空数组直接放行", async () => {
    const tx = {} as unknown as Prisma.TransactionClient;
    await expect(lockSelfOrdersForProductionPlan(tx, [])).resolves.toEqual([]);
  });

  it("非进行中的内部生产单拒绝", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 1, status: "待生效" }]),
    } as unknown as Prisma.TransactionClient;

    await expect(lockSelfOrdersForProductionPlan(tx, [1])).rejects.toThrow(
      "只能汇总「进行中」的内部生产单"
    );
  });

  it("已纳入其他未删除计划时返回 409", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 1, status: "进行中" }]),
      productionPlanSelfOrder: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { selfOrderId: 1, plan: { code: "PPL-20261118-001", title: "生产计划" } },
          ]),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(lockSelfOrdersForProductionPlan(tx, [1])).rejects.toMatchObject({
      status: 409,
    });
  });
});
