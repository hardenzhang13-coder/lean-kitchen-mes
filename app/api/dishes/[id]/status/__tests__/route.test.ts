import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { POST } from "../route";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    dish: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/server/api-auth", () => ({
  logOperation: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  dish: {
    findUnique: jest.Mock;
    updateMany: jest.Mock;
  };
};
const mockedLogOperation = logOperation as jest.Mock;

const completeDish = {
  id: 1,
  name: "宫保鸡丁",
  status: "draft",
  categoryId: 1,
  cuisine: "川菜",
  technique: "爆炒",
  taste: "香辣",
  meatType: "荤菜",
  netDetails: [{ role: "main" }, { role: "support" }],
};

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/dishes/1/status", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function params(id = "1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/dishes/[id]/status", () => {
  beforeEach(() => {
    mockedPrisma.dish.findUnique.mockReset();
    mockedPrisma.dish.updateMany.mockReset();
    mockedLogOperation.mockReset();
  });

  it("拒绝非法 ID 与非法动作", async () => {
    const badId = await POST(createRequest({ action: "publish" }), params("abc"));
    expect(badId.status).toBe(400);

    const badAction = await POST(createRequest({ action: "archive" }), params());
    expect(badAction.status).toBe(400);
  });

  it("菜品不存在时返回 404", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce(null);
    const res = await POST(createRequest({ action: "publish" }), params());
    expect(res.status).toBe(404);
  });

  it("草稿缺主料时拒绝发布", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce({
      ...completeDish,
      netDetails: [{ role: "support" }],
    });
    const res = await POST(createRequest({ action: "publish" }), params());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("主料不能为空");
    expect(mockedPrisma.dish.updateMany).not.toHaveBeenCalled();
  });

  it("完整草稿发布成功并记录操作日志", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce(completeDish);
    mockedPrisma.dish.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await POST(createRequest({ action: "publish" }), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ id: 1, status: "published" });
    expect(mockedPrisma.dish.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: "draft" },
      data: { status: "published" },
    });
    expect(mockedLogOperation).toHaveBeenCalled();
  });

  it("已发布菜品重复发布会幂等返回成功", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce({
      ...completeDish,
      status: "published",
    });

    const res = await POST(createRequest({ action: "publish" }), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ id: 1, status: "published", unchanged: true });
    expect(mockedPrisma.dish.updateMany).not.toHaveBeenCalled();
  });

  it("已发布菜品可停用", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce({
      ...completeDish,
      status: "published",
    });
    mockedPrisma.dish.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await POST(createRequest({ action: "deactivate" }), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("inactive");
  });

  it("拒绝草稿直接停用", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce(completeDish);

    const res = await POST(createRequest({ action: "deactivate" }), params());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("不能执行");
    expect(mockedPrisma.dish.updateMany).not.toHaveBeenCalled();
  });

  it("并发状态已被改变时返回 409", async () => {
    mockedPrisma.dish.findUnique
      .mockResolvedValueOnce(completeDish)
      .mockResolvedValueOnce({ status: "inactive" });
    mockedPrisma.dish.updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await POST(createRequest({ action: "publish" }), params());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("已被其他操作变更");
  });
});
