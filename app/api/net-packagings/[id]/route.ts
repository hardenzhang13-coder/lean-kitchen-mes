import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import {
  conflict,
  internalError,
  notFound,
  success,
} from "@/lib/server/api-response";
import { updateNetPackagingSchema } from "@/lib/server/schemas/net-packaging";
import { validateBody } from "@/lib/server/validate";
import { logger } from "@/lib/server/logger";

async function countReferences(name: string, size: string) {
  return prisma.netIngredient.count({
    where: {
      deletedAt: null,
      packageMaterial: name,
      packageSize: size,
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await prisma.netPackaging.findUnique({ where: { id: Number(id) } });
    if (!row || row.deletedAt) return notFound("净菜包装不存在");
    return success(row);
  } catch (err) {
    logger.error({ err }, "GET /api/net-packagings/[id] failed");
    return internalError("获取净菜包装失败");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const packagingId = Number(id);
    const existing = await prisma.netPackaging.findUnique({ where: { id: packagingId } });
    if (!existing || existing.deletedAt) return notFound("净菜包装不存在");

    const body = await req.json();
    const validation = validateBody(updateNetPackagingSchema, body);
    if (!validation.success) return validation.response;

    const { name, size, isActive } = validation.data;
    const nextName = name ?? existing.name;
    const nextSize = size ?? existing.size;
    const pairChanged = nextName !== existing.name || nextSize !== existing.size;

    if (pairChanged) {
      const duplicate = await prisma.netPackaging.findFirst({
        where: {
          name: nextName,
          size: nextSize,
          NOT: { id: packagingId },
        },
      });
      if (duplicate) {
        return conflict(
          duplicate.deletedAt
            ? "该包装名称与尺寸已存在（已删除记录），请先重新创建恢复"
            : "该包装名称与尺寸已存在"
        );
      }

      const refs = await countReferences(existing.name, existing.size);
      if (refs > 0) {
        return conflict(`该包装已被 ${refs} 条净料/小料引用，不可修改名称或尺寸；如不再使用请停用`);
      }
    }

    const row = await prisma.netPackaging.update({
      where: { id: packagingId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(size !== undefined ? { size } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "NetPackaging",
      entityId: row.id,
      description: `更新净菜包装: ${row.name} / ${row.size}`,
    });
    return success(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return conflict("该包装名称与尺寸已存在");
    }
    logger.error({ err }, "PUT /api/net-packagings/[id] failed");
    return internalError("更新净菜包装失败");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const packagingId = Number(id);
    const existing = await prisma.netPackaging.findUnique({ where: { id: packagingId } });
    if (!existing || existing.deletedAt) return notFound("净菜包装不存在");

    const refs = await countReferences(existing.name, existing.size);
    if (refs > 0) {
      return conflict(`该包装已被 ${refs} 条净料/小料引用，不可删除；如不再使用请停用`);
    }

    await prisma.netPackaging.update({
      where: { id: packagingId },
      data: { deletedAt: new Date() },
    });
    await logOperation(req, {
      action: "DELETE",
      entity: "NetPackaging",
      entityId: packagingId,
      description: `删除净菜包装: ${existing.name} / ${existing.size}`,
    });
    return success({ id: packagingId });
  } catch (err) {
    logger.error({ err }, "DELETE /api/net-packagings/[id] failed");
    return internalError("删除净菜包装失败");
  }
}
