import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { GET } from "../route";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    seasoningProduct: {
      findFirst: jest.fn(),
    },
    dish: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  seasoningProduct: { findFirst: jest.Mock };
  dish: { findMany: jest.Mock; count: jest.Mock };
};

function req(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/seasoning-products/3/dishes${query}`
  );
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/seasoning-products/[id]/dishes", () => {
  it("按 specId 反查引用该产物的菜品并分页返回", async () => {
    mockedPrisma.seasoningProduct.findFirst.mockResolvedValue({ id: 3 });
    mockedPrisma.dish.findMany.mockResolvedValue([
      { id: 11, code: "DSH-HOT-0001", name: "剁椒鱼头", portion: "单人份" },
    ]);
    mockedPrisma.dish.count.mockResolvedValue(1);

    const res = await GET(req("?page=1&pageSize=20"), params("3"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([
      { id: 11, code: "DSH-HOT-0001", name: "剁椒鱼头", portion: "单人份" },
    ]);
    expect(json.pagination.totalItems).toBe(1);
    expect(mockedPrisma.dish.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seasoningDetails: { some: { specId: 3 } } },
      })
    );
  });

  it("产物不存在或已删除时返回 404", async () => {
    mockedPrisma.seasoningProduct.findFirst.mockResolvedValue(null);

    const res = await GET(req(), params("99"));

    expect(res.status).toBe(404);
    expect(mockedPrisma.dish.findMany).not.toHaveBeenCalled();
  });

  it("非法 id 返回 404", async () => {
    const res = await GET(req(), params("abc"));

    expect(res.status).toBe(404);
    expect(mockedPrisma.seasoningProduct.findFirst).not.toHaveBeenCalled();
  });
});
