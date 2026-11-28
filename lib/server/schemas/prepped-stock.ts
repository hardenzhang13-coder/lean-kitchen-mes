import { z } from "zod";

// 完成生产确认（生产计划单）：逐行三态（完成 / 未完成 / 暂不确认）
export const completePlanItemSchema = z.object({
  // 行定位键：sourceType:sourceId（cuttingJson 行）；minor 为历史快照值，服务端归一为 net 匹配
  sourceKey: z.string().regex(/^(net|minor):\d+$/, "sourceKey 格式须为 net:ID"),
  status: z.enum(["completed", "unfinished", "hold"]),
  actualPortions: z.number().min(0).max(100000).optional(),
  remark: z.string().max(200).optional(),
});

export const completeProductionPlanSchema = z.object({
  items: z.array(completePlanItemSchema).min(1).max(500),
});

// 创建出库单
export const createOutboundItemSchema = z.object({
  // 小料已并入净料（2026-11-28），出库行仅 net；历史 minor 库存在迁移中已合并
  sourceType: z.enum(["net"], { message: "出库行类型无效" }),
  sourceId: z
    .number({ message: "出库行 ID 无效" })
    .int({ message: "出库行 ID 无效" })
    .positive({ message: "出库行 ID 无效" }),
  shippedPortions: z
    .number({ message: "出库份数无效" })
    .min(0, "出库份数不能小于 0")
    .max(100000, "出库份数不能超过 100000"),
});

export const createOutboundSchema = z.object({
  scheduleId: z
    .number({ message: "排程单无效" })
    .int({ message: "排程单无效" })
    .positive({ message: "排程单无效" })
    .optional(),
  selfOrderId: z
    .number({ message: "内部生产单无效" })
    .int({ message: "内部生产单无效" })
    .positive({ message: "内部生产单无效" })
    .optional(),
  /** 生产批次来源：切配计划单 ID；scheduleId 与 productionPlanId 二选一 */
  productionPlanId: z
    .number({ message: "生产批次无效" })
    .int({ message: "生产批次无效" })
    .positive({ message: "生产批次无效" })
    .optional(),
  /** 门店收货主体；排程出库与批次出库都必须明确收货门店 */
  storeId: z
    .number({ message: "请选择收货门店" })
    .int({ message: "请选择收货门店" })
    .positive({ message: "请选择收货门店" }),
  // 省略时由服务端取当前时间；不对出库时间做限制（允许补录未来时间）
  outboundAt: z.coerce.date({ message: "出库时间无效" }).optional(),
  remark: z.string({ message: "备注无效" }).max(200, "备注最长 200 字").optional(),
  items: z
    .array(createOutboundItemSchema, { message: "出库明细格式错误" })
    .min(1, "请至少选择一行出库明细")
    .max(500, "出库明细最多 500 行"),
}).superRefine((value, ctx) => {
  // 切配中心（内部生产单）来源出库已随内部生产单页面下线，仅保留字段以渲染历史单据
  if (value.selfOrderId != null) {
    ctx.addIssue({
      code: "custom",
      path: ["selfOrderId"],
      message: "切配中心来源出库已下线：内部生产单已并入生产计划单流程，新出库单请按门店排程单创建",
    });
    return;
  }
  const sourceCount = [value.scheduleId, value.productionPlanId].filter(
    (source) => source != null
  ).length;
  if (sourceCount !== 1) {
    ctx.addIssue({
      code: "custom",
      path: ["scheduleId"],
      message: "排程单出库与生产批次出库二选一",
    });
  }
  const totalPortions = value.items.reduce(
    (sum, item) => sum + item.shippedPortions,
    0
  );
  if (totalPortions <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["items"],
      message: "本次出库总数必须大于 0",
    });
  }
});

export const batchOutboundQuoteSchema = z.object({
  productionPlanId: z
    .coerce.number({ message: "生产批次无效" })
    .int({ message: "生产批次无效" })
    .positive({ message: "生产批次无效" }),
});

export const productionBatchQuerySchema = z.object({
  page: z
    .coerce.number({ message: "页码无效" })
    .int({ message: "页码无效" })
    .min(1, "页码无效")
    .default(1),
  pageSize: z
    .coerce.number({ message: "每页数量无效" })
    .int({ message: "每页数量无效" })
    .min(1, "每页数量无效")
    .max(100, "每页数量最多 100")
    .default(20),
});

export const outboundQuerySchema = z.object({
  status: z.string().max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const preppedStockQuerySchema = z.object({
  q: z.string().max(100).optional(),
  l1: z.string().max(50).optional(),
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
