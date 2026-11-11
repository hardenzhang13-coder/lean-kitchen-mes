import type { Prisma } from "@prisma/client";
import { syncSourceScheduleStatuses } from "../production-plan-assignment";

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
  it("只完成全部切配行均已终态的来源排程", async () => {
    const { tx, updateMany } = createTx([
      { scheduleId: 1, status: "completed" },
      { scheduleId: 1, status: "unfinished" },
      { scheduleId: 2, status: "completed" },
      { scheduleId: 2, status: "pending" },
    ]);

    const completed = await syncSourceScheduleStatuses(tx, [1, 2]);

    expect(completed).toEqual([1]);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1] }, status: "进行中" },
      data: { status: "已完成" },
    });
  });

  it("存在待确认行时不更新来源排程", async () => {
    const { tx, updateMany } = createTx([
      { scheduleId: 3, status: "pending" },
    ]);

    const completed = await syncSourceScheduleStatuses(tx, [3]);

    expect(completed).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
