import { buildProductionPlanSourceSnapshot } from "../production-plan";

describe("buildProductionPlanSourceSnapshot", () => {
  it("v2 快照同时包含门店排程与内部生产单，并按日期排序", () => {
    const snapshot = buildProductionPlanSourceSnapshot(
      [
        {
          id: 1,
          code: "SCH-20261118-001",
          title: "午餐",
          scheduleDate: new Date("2026-11-18T00:00:00.000Z"),
          store: { id: 1, name: "甲门店" },
          items: [],
        },
      ],
      [
        {
          id: 9,
          code: "SPO-20261119-001",
          title: "切配中心·周四（11月19日）内部生产单",
          produceDate: new Date("2026-11-19T00:00:00.000Z"),
          remark: null,
          items: [
            {
              sourceType: "net",
              sourceId: 100,
              itemCode: "NET-100",
              itemName: "土豆丝",
              packageSpec: 500,
              unit: "g",
              portions: 2,
              requiredQty: 1000,
              grossNeedJin: 2.5,
            },
          ],
        },
        {
          id: 8,
          code: "SPO-20261118-001",
          title: "切配中心·周三（11月18日）内部生产单",
          produceDate: new Date("2026-11-18T00:00:00.000Z"),
          remark: "备货",
          items: [],
        },
      ]
    );

    expect(snapshot.version).toBe(2);
    expect(snapshot.stores.map((store) => store.storeName)).toEqual(["甲门店"]);
    expect(snapshot.selfProduction.map((order) => order.code)).toEqual([
      "SPO-20261118-001",
      "SPO-20261119-001",
    ]);
    expect(snapshot.selfProduction[1].items[0]).toEqual(
      expect.objectContaining({
        sourceId: 100,
        itemName: "土豆丝",
        portions: 2,
        requiredQty: 1000,
      })
    );
  });
});
