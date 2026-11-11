import {
  buildPrepLabels,
  calculatePrepLabelCopies,
  formatPrepLabelDate,
} from "@/lib/shared/prep-label";

describe("prep label helpers", () => {
  it("按封装规格计算需要打印的标签张数", () => {
    expect(calculatePrepLabelCopies(2100, 700)).toBe(3);
    expect(calculatePrepLabelCopies(0, 700)).toBe(0);
    expect(calculatePrepLabelCopies(1000, 0)).toBe(0);
  });

  it("名称和封装规格取净料/小料档案字段", () => {
    const result = buildPrepLabels(
      [
        {
          sourceType: "net",
          sourceId: 1,
          sourceCode: "PRD-0001",
          itemName: "计划快照名称",
          requiredQty: 1400,
        },
        {
          sourceType: "minor",
          sourceId: 2,
          sourceCode: "PRD-0002",
          itemName: "计划快照小料",
          requiredQty: 200,
        },
      ],
      [
        { id: 1, name: "净料档案名称", packageSpec: 700 },
        { id: 2, name: "小料档案名称", packageSpec: 100 },
      ]
    );

    expect(result.labels).toEqual([
      {
        sourceType: "net",
        sourceId: 1,
        itemName: "净料档案名称",
        packageSpec: 700,
        copies: 2,
      },
      {
        sourceType: "minor",
        sourceId: 2,
        itemName: "小料档案名称",
        packageSpec: 100,
        copies: 2,
      },
    ]);
    expect(result.totalCopies).toBe(4);
    expect(result.skipped).toEqual([]);
  });

  it("缺少档案或封装规格时跳过并给出原因", () => {
    const result = buildPrepLabels(
      [
        {
          sourceType: "net",
          sourceId: 1,
          sourceCode: "PRD-0001",
          itemName: "无档案净菜",
          requiredQty: 700,
        },
        {
          sourceType: "minor",
          sourceId: 2,
          sourceCode: "PRD-0002",
          itemName: "无规格小料",
          requiredQty: 100,
        },
      ],
      [{ id: 2, name: "无规格小料", packageSpec: null }]
    );

    expect(result.labels).toEqual([]);
    expect(result.skipped.map((item) => item.reason)).toEqual([
      "净料/小料档案不存在或已停用",
      "缺少有效封装规格",
    ]);
  });

  it("生产日期按指定时区格式化为 YYYY-MM-DD", () => {
    const printTime = new Date("2026-11-10T16:30:00.000Z");
    expect(formatPrepLabelDate(printTime, "Asia/Shanghai")).toBe("2026-11-11");
  });
});
