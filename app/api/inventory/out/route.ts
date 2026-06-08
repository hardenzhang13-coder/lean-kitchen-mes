import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getUserFromRequest } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { items, summary }: {
    items: Array<{
      ingredientId: number;
      qty: number;
      unit: string;
    }>;
    summary?: string;
  } = body;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const inv = await tx.inventory.findUnique({
          where: { ingredientId: item.ingredientId },
        });
        if (!inv) {
          throw new Error(`食材 ID ${item.ingredientId} 没有库存记录`);
        }
        const currentQty = Number(inv.currentQty);
        const outQty = Number(item.qty);
        if (currentQty < outQty) {
          throw new Error(`食材 ${item.ingredientId} 库存不足（当前 ${currentQty}，需出库 ${outQty}）`);
        }
        const newQty = currentQty - outQty;

        await tx.inventory.update({
          where: { ingredientId: item.ingredientId },
          data: { currentQty: newQty },
        });

        await tx.inventoryLedger.create({
          data: {
            ingredientId: item.ingredientId,
            changeType: "出库",
            changeQty: outQty,
            unit: item.unit,
            balance: newQty,
            source: summary ? `出库/${summary}` : "出库",
            operator,
          },
        });
      }
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "InventoryOutbound",
      description: summary || "出库",
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
