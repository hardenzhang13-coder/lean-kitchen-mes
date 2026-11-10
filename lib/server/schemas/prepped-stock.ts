import { z } from "zod";

// 完成生产确认（生产计划单）：逐行三态（完成 / 未完成 / 暂不确认）
export const completePlanItemSchema = z.object({
  // 行定位键：sourceType:sourceId（cuttingJson 行）
  sourceKey: z.string().regex(/^(net|minor):\d+$/, "sourceKey 格式须为 net:ID 或 minor:ID"),
  status: z.enum(["completed", "unfinished", "hold"]),
  actualPortions: z.number().min(0).max(100000).optional(),
  remark: z.string().max(200).optional(),
});

export const completeProductionPlanSchema = z.object({
  items: z.array(completePlanItemSchema).min(1).max(500),
});

// 创建出库单
export const createOutboundItemSchema = z.object({
  sourceType: z.enum(["net", "minor"]),
  sourceId: z.number().int().positive(),
  shippedPortions: z.number().min(0).max(100000),
});

export const createOutboundSchema = z.object({
  scheduleId: z.number().int().positive(),
  remark: z.string().max(200).optional(),
  items: z.array(createOutboundItemSchema).min(1).max(500),
});

export const outboundQuerySchema = z.object({
  status: z.string().max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const preppedStockQuerySchema = z.object({
  q: z.string().max(100).optional(),
  l1: z.string().max(50).optional(),
  type: z.enum(["net", "minor"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const preppedLedgerQuerySchema = z.object({
  type: z.enum(["stock_in", "stock_out", "stock_rollback"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const voidOutboundSchema = z.object({
  reason: z.string().min(1, "请填写作废原因").max(200),
});