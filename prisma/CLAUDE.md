# 数据库层（prisma）

本目录包含 Prisma Schema、迁移历史与种子数据，是系统数据模型的唯一真相源。

## 文件说明

| 文件 | 用途 |
|------|------|
| `schema.prisma` | 全量数据模型定义（约 25 张表） |
| `seed.ts` | 初始化种子数据（分类、单位、默认用户等） |
| `migrations/` | Prisma 迁移文件 |
| `scripts/migrate-soy-sauce-to-seasoning.js` | 一次性历史数据迁移脚本 |

## 核心领域模型

### 三层食材体系

```
Ingredient（原料）
   │
   ├── 直接采购入库，库存单位通常为斤/件
   │
   └── NetIngredient（净料）
          │
          ├── yieldRate：出成率（如 0.65 表示 100g 原料出 65g 净料）
          └── Dish（菜品）
                 ├── DishNetDetail（主料/辅料）
                 ├── DishMinorDetail（小料）
                 ├── DishSeasoningDetail（调料）
                 └── DishSauceDetail（酱料）
```

### 菜品域

| 模型 | 说明 |
|------|------|
| `DishCategory` | 菜品分类，编码唯一 |
| `Dish` | 菜品主表，含 `status`（draft / pending / published）、自动计算的 `cost` |
| `DishNetDetail` | 主料/辅料明细，`role` 区分 main/support |
| `DishMinorDetail` | 小料明细，关联 `NetIngredient` |
| `DishSeasoningDetail` | 调料明细，`type` 为 seasoning，关联 `Ingredient` |
| `DishSauceDetail` | 酱料明细，关联 `SauceIngredient` |
| `DishProcess` | 加工工序，按 `stage` + `stepNo` 排序 |

### 排程域

| 模型 | 说明 |
|------|------|
| `Schedule` | 生产排程主表，`status`：待生效 / 进行中 / 已完成 |
| `ScheduleItem` | 排程菜品及份数 |
| `CuttingOrder` | 切配工单，由 `buildCuttingOrders()` 自动生成 |
| `PurchasePlan` | 采购计划，由 `buildPurchasePlans()` 自动生成 |

### 采购域

| 模型 | 说明 |
|------|------|
| `Supplier` | 供应商 |
| `PurchaseReceipt` | 采购单，`status`：待结算 / 已结算 / 已作废 |
| `PurchaseReceiptItem` | 采购单行项目，记录入库数量与库存流水 |
| `PurchaseReimbursement` | 报销单，聚合多张采购单 `receiptIds` |

### 库存域

| 模型 | 说明 |
|------|------|
| `Inventory` | 当前库存量，`ingredientId` 唯一 |
| `InventoryLedger` | 库存流水，不可删除，记录 `changeType`（入库/出库） |

### 系统域

| 模型 | 说明 |
|------|------|
| `User` | 用户，自研 JWT 认证 |
| `OperationLog` | 操作日志，由 `logOperation()` 写入 |
| `Unit` | 计量单位字典；重量类带 `gramsPerUnit`（1 单位合多少克），驱动全系统斤/克换算；`isActive` 停用后业务端下拉不再出现（设置页用 `?includeInactive=1` 查全量） |

## 软删除约定

以下模型使用 `deletedAt` 字段实现软删除，查询业务数据时需显式过滤 `deletedAt: null`：

- `Ingredient`
- `NetIngredient`

其他模型（如 `Dish`、`PurchaseReceipt`）目前使用状态字段控制生命周期，未实现软删除。

## 关键索引

- `NetIngredient.sourceIngredientId` — 原料→净料关联
- `NetIngredient.deletedAt` / `NetIngredient.l2Code` — 列表过滤常用
- 各明细表均建立外键关系，并配置 `onDelete: Cascade`

## 编码生成规则

菜品编码由 API 层在事务中生成，格式为：

```
DSH-{categoryCode}-{0001}
```

按前缀取当前最大序号 +1，失败时带重试机制（Serializable 隔离级别）。

## 常用命令

```bash
# 推送 schema 变更到数据库
npx prisma db push

# 生成迁移文件
npx prisma migrate dev

# 重新生成 Prisma Client
npx prisma generate

# 运行种子脚本
npx prisma db seed
```

## 变更注意事项

1. Schema 变更优先使用 `prisma migrate dev` 生成迁移文件，避免直接 `db push` 到生产环境。
2. 新增实体时同步更新 `lib/schemas/` 下的 zod schema 与对应 API 路由。
3. 涉及库存、采购单、排程的字段变更，必须同步检查 `schedule-utils.ts`、`lib/spec-parser.ts`、采购单 API 中的事务逻辑。
4.  Decimal 字段在 TypeScript 中返回为 `Decimal` 对象，计算前通常需要 `Number()` 转换。
