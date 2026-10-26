# 采购单 API（app/api/purchase-receipts）

本目录提供采购单的录入、查询、编辑、作废，以及 AI 图片识别功能。

## 路由结构

| 文件 | 端点 | 用途 |
|------|------|------|
| `route.ts` | `GET /api/purchase-receipts` / `POST /api/purchase-receipts` | 列表查询、录入采购单 |
| `[id]/route.ts` | `GET /api/purchase-receipts/[id]` / `PUT /api/purchase-receipts/[id]` / `DELETE /api/purchase-receipts/[id]` | 详情、编辑、作废/删除 |
| `recognize/route.ts` | `POST /api/purchase-receipts/recognize` | AI 图片识别与食材匹配 |

## 状态机

采购单 `PurchaseReceipt.status` 有三态：

- **待结算** — 刚录入，可编辑、可作废
- **已结算** — 已归入报销单结算，不可编辑/作废
- **已作废** — 已回滚库存并删除流水，可物理删除（force）

> 结算状态还会参考 `PurchaseReimbursement`：只要某采购单 `id` 出现在 `status === "settled"` 的报销单 `receiptIds` 中，即视为已结算。

## 列表查询

`GET /api/purchase-receipts` 支持：

- `startDate` / `endDate` — 按采购日期范围筛选
- `status` — 待结算 / 已结算 / 已作废
- `q` — 按摘要、供应商名称、操作人、ID 搜索
- `page` / `pageSize` — 分页

响应中每条记录会附加 `isSettled` 和统一后的 `effectiveStatus`。

## 录入采购单

`POST /api/purchase-receipts` 流程：

1. 校验请求体（`createPurchaseReceiptSchema`）
2. 在 Prisma 事务中：
   - 创建 `PurchaseReceipt`
   - 逐条创建 `PurchaseReceiptItem`
   - 对有 `ingredientId` 的条目：
     - 更新 `Ingredient.latestRefPrice`
     - 更新或创建 `Inventory`
     - 写入 `InventoryLedger` 入库流水
3. 记录 `OperationLog`

## 编辑采购单

`PUT /api/purchase-receipts/[id]` 限制：

- 只有"待结算"采购单可编辑
- 事务内先回滚旧条目库存（扣减 `stockInQty`、删除旧流水），再写入新条目
- 重新写入库存和流水

## 作废采购单

`DELETE /api/purchase-receipts/[id]`（非 force）：

- 已被结算的采购单不可作废
- 事务内：
  - 扣减对应 `Inventory.currentQty`
  - 删除来源为 `采购入库/${receiptId}` 的 `InventoryLedger` 流水
  - 将 `PurchaseReceipt.status` 改为"已作废"

## 物理删除

`DELETE /api/purchase-receipts/[id]?force=true`：

- 只能删除"已作废"状态
- 已被结算的不可删除

## AI 识别

`POST /api/purchase-receipts/recognize`

1. 接收 `imageBase64`
2. 计算图片哈希，检查是否已存在未作废的重复采购单
3. 调用 `lib/ai.ts` 的 `recognizePurchaseReceipt()` 进行 OCR+结构化提取
4. 加载全部未删除 `Ingredient`、L2 分类、单位字典、调料分类编码
5. 对每条识别结果：
   - 按名称/别名相似度匹配 `Ingredient`
   - 相似度 `≥ 0.9` 视为匹配成功
   - 根据规格调用 `lib/spec-parser.ts` 的 `calculateStockInfo()` 计算入库单位和数量
   - 采购单位为"斤"时直接按 1:1 入库
6. 返回带 `matched`、`matchType`、`ingredientId` 的识别条目，以及供应商、总金额、重复警告

### 匹配规则

- 匹配对象仅查询 `Ingredient` 表
- 调料通过 `l2Code` 属于 `seasoningL2Codes` 判定
- 未匹配项可在前端弹窗中直接创建新原料

## 库存联动

采购单是与库存直接交互的核心入口之一：

- 入库：创建/更新 `Inventory`，写入 `InventoryLedger`
- 编辑：先回滚旧库存，再重新入库
- 作废：回滚库存并删除流水

所有库存更新都在 Prisma `$transaction` 中执行。

## 注意事项

- `PurchaseReceiptItem.amount` 为条目金额，不参与库存计算；库存以 `stockInQty` 为准。
- `priceUnit` 与 `purchaseUnit` 在创建/编辑时会做兜底处理，默认"件"。
- 编辑时旧条目的 `latestRefPrice` 不会被反向恢复，新单价会直接覆盖。
- 列表查询已省略 `imageUrl`、`imageHash` 字段以减少响应体积。
