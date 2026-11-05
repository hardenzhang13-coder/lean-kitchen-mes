import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success, internalError, conflict, badRequest, notFound } from "@/lib/server/api-response";
import { updateStoreSchema } from "@/lib/server/schemas/store";
import { validateBody } from "@/lib/server/validate";
import { normalizeName } from "@/lib/shared/name-utils";
import { logger } from "@/lib/server/logger";

/** 归一化重名查重（排除已软删除门店） */
async function findStoreByName(name: string, excludeId?: number) {
  const normalized = normalizeName(name);
  const stores = await prisma.store.findMany({
    where: { deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true },
  });
  return stores.find((st) => normalizeName(st.name) === normalized) ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await prisma.store.findUnique({
      where: { id: Number(id) },
      include: { _count: { select: { schedules: true } } },
    });
    if (!row || row.deletedAt) return notFound("门店不存在");
    return success(row);
  } catch (err) {
    logger.error({ err }, "GET /api/stores/[id] failed");
    return internalError("获取门店失败");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const storeId = Number(id);

    const existing = await prisma.store.findUnique({ where: { id: storeId } });
    if (!existing || existing.deletedAt) return notFound("门店不存在");

    const body = await req.json();
    const validation = validateBody(updateStoreSchema, body);
    if (!validation.success) return validation.response;

    const { name, manager, phone, address, isActive } = validation.data;

    // 系统内置门店保护：名称与启用状态不可修改
    if (
      existing.isSystem &&
      ((name !== undefined && name.trim() !== existing.name) ||
        (isActive !== undefined && !isActive))
    ) {
      return conflict("系统内置门店不允许修改名称或停用");
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) return badRequest("门店名称不能为空");
      const dup = await findStoreByName(trimmedName, storeId);
      if (dup) return conflict(`门店名称已存在: ${dup.name}`);
    }

    const data: Prisma.StoreUpdateInput = {};
    if (name !== undefined) data.name = name.trim();
    if (manager !== undefined) data.manager = manager?.trim() || null;
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;
    if (isActive !== undefined) data.isActive = isActive;

    const row = await prisma.store.update({ where: { id: storeId }, data });
    await logOperation(req, {
      action: "UPDATE",
      entity: "Store",
      entityId: row.id,
      description: `更新门店: ${row.name}`,
    });
    return success(row);
  } catch (err) {
    logger.error({ err }, "PUT /api/stores/[id] failed");
    return internalError("更新门店失败");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const storeId = Number(id);

    const existing = await prisma.store.findUnique({ where: { id: storeId } });
    if (!existing || existing.deletedAt) return notFound("门店不存在");
    if (existing.isSystem) return conflict("系统内置门店不可删除");

    const scheduleCount = await prisma.schedule.count({ where: { storeId } });
    if (scheduleCount > 0) {
      return conflict(`该门店已被 ${scheduleCount} 条排程引用，无法删除`);
    }

    await prisma.store.update({
      where: { id: storeId },
      data: { deletedAt: new Date() },
    });
    await logOperation(req, {
      action: "DELETE",
      entity: "Store",
      entityId: storeId,
      description: `删除门店: ${existing.name}`,
    });
    return success({ id: storeId });
  } catch (err) {
    logger.error({ err }, "DELETE /api/stores/[id] failed");
    return internalError("删除门店失败");
  }
}
