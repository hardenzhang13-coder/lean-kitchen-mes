import {
  createStoreSchema,
  updateStoreSchema,
} from "@/lib/server/schemas/store";
import { validateStoreScenario } from "@/lib/server/portion-profile-utils";

/** 场景档案模拟：findFirst 按 scenario 命中返回行，否则 null */
function mockDb(scenarios: Array<{ scenario: string; isActive: boolean }>) {
  return {
    portionProfile: {
      findFirst: async ({ where }: { where: { scenario: string } }) => {
        const hit = scenarios.find((s) => s.scenario === where.scenario);
        return hit ? { id: 1 } : null;
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("门店场景校验", () => {
  it("新建门店场景必填", () => {
    const result = createStoreSchema.safeParse({ name: "测试店" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("scenario"))).toBe(
        true
      );
    }
  });

  it("新建门店场景为空字符串被拒绝", () => {
    const result = createStoreSchema.safeParse({ name: "测试店", scenario: "  " });
    expect(result.success).toBe(false);
  });

  it("编辑门店场景省略不变、显式提供则必填", () => {
    expect(updateStoreSchema.safeParse({ manager: "张三" }).success).toBe(true);
    expect(updateStoreSchema.safeParse({ scenario: "" }).success).toBe(false);
    expect(updateStoreSchema.safeParse({ scenario: "社区" }).success).toBe(true);
  });

  it("场景命中份量档案（含停用行）通过", async () => {
    const db = mockDb([
      { scenario: "社区", isActive: true },
      { scenario: "团餐食堂", isActive: false },
    ]);
    expect(await validateStoreScenario("社区", db)).toBeNull();
    expect(await validateStoreScenario("团餐食堂", db)).toBeNull();
  });

  it("场景未命中份量档案返回可读错误文案", async () => {
    const db = mockDb([{ scenario: "社区", isActive: true }]);
    const error = await validateStoreScenario("商圈", db);
    expect(error).toContain("商圈");
    expect(error).toContain("设置-份量");
  });
});
