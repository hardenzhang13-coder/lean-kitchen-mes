import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { buildCuttingOrders, buildPurchasePlans } from "@/app/lib/schedule-utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const q = searchParams.get("q");

  const where: any = {};
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  if (q) {
    where.title = { contains: q };
  }

  const rows = await prisma.schedule.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          dish: { select: { id: true, name: true, code: true } },
        },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  // 计算菜品总量
  const enriched = rows.map((r) => ({
    ...r,
    totalQuantity: r.items.reduce((s, it) => s + it.quantity, 0),
    dishCount: r._count.items,
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, scheduleDate, scope, items }: {
    title: string;
    scheduleDate: string;
    scope?: string;
    items: Array<{ dishId: number; quantity: number }>;
  } = body;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  if (!title.trim()) {
    return NextResponse.json({ error: "请填写排程标题" }, { status: 400 });
  }
  if (!scheduleDate) {
    return NextResponse.json({ error: "请选择生产日期" }, { status: 400 });
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "请至少选择一道菜品" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. 创建排程
      const schedule = await tx.schedule.create({
        data: {
          title: title.trim(),
          scheduleDate: new Date(scheduleDate),
          scope: scope || "全部食堂",
          status: "待生效",
          operator,
        },
      });

      // 2. 创建菜品清单
      for (const item of items) {
        await tx.scheduleItem.create({
          data: {
            scheduleId: schedule.id,
            dishId: item.dishId,
            quantity: Number(item.quantity),
          },
        });
      }

      // 3. 构建切配工单
      const cuttingData = await buildCuttingOrders(tx as any, schedule.id, items);
      for (const co of cuttingData) {
        await tx.cuttingOrder.create({ data: co as any });
      }

      // 4. 构建采购计划
      const purchaseData = await buildPurchasePlans(tx as any, schedule.id, items);
      for (const pp of purchaseData) {
        await tx.purchasePlan.create({ data: pp as any });
      }

      return schedule;
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "Schedule",
      entityId: result.id,
      description: `创建排程: ${result.title}`,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
