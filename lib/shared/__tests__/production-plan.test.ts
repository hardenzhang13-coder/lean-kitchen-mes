import { buildSourceScheduleSnapshot } from "../production-plan";

describe("buildSourceScheduleSnapshot", () => {
  it("按门店名称和排程日期生成稳定快照", () => {
    const snapshot = buildSourceScheduleSnapshot([
      {
        id: 2,
        code: "SCH-20261112-002",
        title: "晚餐",
        scheduleDate: new Date("2026-11-12T00:00:00.000Z"),
        store: { id: 2, name: "乙门店" },
        items: [
          {
            id: 3,
            quantity: 6,
            dish: {
              id: 8,
              code: "DSH-008",
              name: "测试菜",
              portion: "单人份",
              meatType: "荤菜",
            },
          },
        ],
      },
      {
        id: 1,
        code: "SCH-20261112-001",
        title: "午餐",
        scheduleDate: new Date("2026-11-12T00:00:00.000Z"),
        store: { id: 1, name: "甲门店" },
        items: [
          {
            id: 2,
            quantity: 3,
            dish: {
              id: 7,
              code: "DSH-007",
              name: "测试菜",
              portion: "单人份",
              meatType: "素菜",
            },
          },
        ],
      },
      {
        id: 0,
        code: "SCH-20261111-001",
        title: "前一日",
        scheduleDate: new Date("2026-11-11T00:00:00.000Z"),
        store: { id: 2, name: "乙门店" },
        items: [],
      },
    ]);

    expect(snapshot.version).toBe(1);
    expect(snapshot.stores.map((store) => store.storeName)).toEqual([
      "甲门店",
      "乙门店",
    ]);
    expect(snapshot.stores[1].schedules.map((schedule) => schedule.code)).toEqual([
      "SCH-20261111-001",
      "SCH-20261112-002",
    ]);
    expect(snapshot.stores[0].schedules[0].items[0]).toEqual(
      expect.objectContaining({
        dishCode: "DSH-007",
        dishName: "测试菜",
        quantity: 3,
      })
    );
  });
});
