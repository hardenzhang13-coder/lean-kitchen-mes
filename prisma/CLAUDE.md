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
Ingredient（原料，kind=food）
   │
   ├── 直接采购入库，库存单位通常为斤/件
   │
   ├── NetIngredient（净料）
          │
          ├── yieldRate：出成率（如 0.65 表示 100g 原料出 65g 净料）
          ├── packageSpec：封装规格（g），净料必填；单位固定 g
          ├── processingFeePerJin：封装加工费（元/斤），空 = 0
          ├── 价格体系：成本价(元/斤) = 原料每斤单价 ÷ 出成率；出库价 = 成本价 + 加工费；
          │   标准规格价格(元/份) = 出库价 × 封装规格 ÷ 500（纯计算，见 lib/shared/net-price.ts）
          └── Dish（菜品）
                 ├── DishNetDetail（主料/辅料）
                 └── DishMinorDetail（小料）

Ingredient（调味品，kind=seasoning，2026-11-25 升级：独立原材料层，不挂食材一二级分类，SEA 分类树已移除）
   │
   └── SeasoningProduct（调料产物，物理表 standard_seasonings；StandardSeasoning 已改名）
          │
          ├── productType：单品调料 / 复合调料 / 成品酱料（三种同构产物，只是叫法，无配方）
          ├── sourceMode：transform（转化）/ purchase（外购）
          ├── packageSpec：封装规格（g）；portion：份量（portion_profiles 标签）
          ├── transform 行：sourceIngredientId + yieldRate（出成率 %）
          ├── purchase 行：brand / purchaseSpec / purchaseUnit / latestRefPrice / pricePerJin（手填每斤单价）
          ├── 价格体系（纯计算，见 lib/shared/seasoning-spec.ts）：转化单价 = 调味品每斤单价 ÷ 出成率；
          │   外购单价 = 手填每斤单价；成本价 = 单价 + 封装加工费；出库价 = 成本价 ÷ (1 − 毛利率/100)；
          │   标准规格价(元/份) = 出库价 × 封装规格 ÷ 500
          └── DishSeasoningDetail（调料）
                 ├── spec_id：指向 SeasoningProduct（新口径行，source_id 置 0 哨兵）
                 └── source_id + spec_id 空：存量旧口径行（直引调味品原料），只读保留

SauceIngredient / SauceRecipeDetail / DishSauceDetail（酱料配方机制，业务剥离）：
写 API 冻结、页面下线，模型与历史数据只读保留（先例同 SelfProductionOrder）。
```

### 食材分类字典

| 模型 | 说明 |
|------|------|
| `IngredientCategoryL1` | 一级分类，`description` 可填；`isActive` 停用后业务端树形接口不再返回（无启用二级分类的一级分类也一并隐藏） |
| `IngredientCategoryL2` | 二级分类，编号约定 `L1前缀-后缀`（如 `VEG-LEF`）；`parentCode` 外键关联 L1.code（级联删除）；`isActive` 同 L1 |

- 业务表中的 `l2Code` 均为**字符串引用（非外键）**：删除/改编号分类前必须经 `lib/server/category-references.ts` 引用检查，被引用时禁止并引导停用。
- 设置页查全量传 `?includeInactive=1`，业务端默认只返回启用中的分类。

### 包装字典

| 模型 | 说明 |
|------|------|
| `NetPackaging` | 净菜包装字典（`name` + `size` 唯一）；`sortOrder` 展示顺序（2026-11-24，迁移 20261124120000），设置页可上下移，列表按 `(sort_order, id)` 排序；软删除，被净料/小料引用时禁止改名称/尺寸 |

### 份量档案

| 模型 | 说明 |
|------|------|
| `PortionProfile` | 份量档案（设置模块「份量」，迁移 20261123083624）。每行 = 一个具体份量选项；`portion` 标签全表唯一；`scenario` 同场景允许多行；`multiplier` 为正整数倍率（份量 = 单人份 × 倍率）；`isBase` = 单人份基本单元锁定，API 拒绝编辑/停用/删除（zod 不接受 isBase 字段）；无业务表引用，物理删除 |

- **打通状态（2026-11-24，迁移 20261124100000）**：`Dish` / `NetIngredient` / `StandardSeasoning` 的 `portion` 字段统一落本表标签（存量「小碗菜」已迁为「单人份」）；写校验 `lib/server/portion-profile-utils.ts`，客户端选项 `lib/client/use-portion-profiles.ts`；转化倍率 = 目标 multiplier ÷ 源 multiplier
- **菜品库表头分组（2026-11-24）**：菜品库份量分组 Tab 按本表 `scenario` 动态生成（`app/dishes/page.tsx` + `GET /api/dishes?portionGroup=<scenario>`，服务端按场景档案行做 IN 过滤）；原硬编码 single/community/canteen 三档已下线

### 建档时间（createdAt）

- `Ingredient`（原料 + 调料）、`NetIngredient`（净料 + 小料）、`SauceIngredient`（酱料）三张表都有 `createdAt`，默认 `now()`。
- 展示口径：只在**详情页顶部（关闭按钮下方）**显示「建档 YYYY-MM-DD HH:mm」，**列表页不展示**。
- 枚举新加同口径列时：先加可空列 → 存量回填为初始建库日 → 再改为 `NOT NULL DEFAULT CURRENT_TIMESTAMP`，避免存量行拿到假的建档时间。

### 菜品域

| 模型 | 说明 |
|------|------|
| `DishCategory` | 菜品分类，编码唯一；`sortOrder` 展示顺序（设置页可上下移，列表按 `(sort_order, id)` 排序）；`isActive` 停用后业务端不再可选（设置页用 `?includeInactive=1` 查全量） |
| `Dish` | 菜品主表，含 `status`（draft / published / inactive）、`categoryId`（可空，未分类编号用 `DSH-GEN-*`）、自动计算的 `cost`；`portion` 默认「单人份」（2026-11-24 起，迁移 20261124100000） |
| `DishNetDetail` | 主料/辅料明细，`role` 区分 main/support；`amountG` 是冗余缓存，必须等于 `NetIngredient.packageSpec` |
| `DishMinorDetail` | 小料明细，关联 `NetIngredient`；`amountG` 同上 |
| `DishSeasoningDetail` | 调料明细，`type` 为 seasoning；`spec_id` 关联 `SeasoningProduct`（新口径行，`source_id` 置 0 哨兵）；`source_id` 直引 `Ingredient`（kind=seasoning）为存量旧口径行，只读保留 |
| `DishSauceDetail` | 酱料明细，关联 `SauceIngredient`；酱料机制业务剥离，存量行只读 |
| `DishProcess` | 加工工序，按 `stage` + `stepNo` 排序 |

### 排程域

| 模型 | 说明 |
|------|------|
| `Schedule` | 生产排程主表，`status`：待生效 / 进行中 / 已完成；门店排程完成由成功出库单回写 |
| `ScheduleItem` | 排程菜品及份数 |
| `CuttingOrder` | 切配工单，由 `buildCuttingOrders()` 自动生成 |
| `PurchasePlan` | 采购计划，由 `buildPurchasePlans()` 自动生成 |
| `Store` | 门店（排程组织单位），`scenario` 场景打通份量档案 `portion_profiles.scenario`（2026-11-24，新建必填、服务端查表校验）；`isSystem` 系统店不可删/停用；被排程引用禁删 |

### 生产计划域

| 模型 | 说明 |
|------|------|
| `ProductionPlan` | 生产计划单，`cuttingJson` / `purchaseJson` / `sourceScheduleJson` 为生成时快照（v2 含 `selfProduction[]`），`remark` 为新建/编辑备注（可空），软删除 |
| `ProductionPlanSchedule` | 计划 ↔ 来源门店排程 |
| `SelfProductionOrder` | 内部生产单（**2026-11 页面已下线，停止新写入**，模型与历史数据保留只读），`status`：待生效 / 进行中 / 已完成；不做软删除 |
| `SelfProductionItem` | 明细：`sourceType`（net / minor 由二级分类 MIN 服务端派生）、`sourceId` 弱引用 `net_ingredients.id`、`portions` |
| `ProductionPlanSelfOrder` | 计划 ↔ 来源内部生产单（历史关联，停止新写入） |

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
| `PreppedStock` | 净菜当前库存（份 + g 双单位），唯一键 `(sourceType, sourceId)` |
| `PreppedStockLedger` | 净菜库存流水，不可删除，记录 `changeType`（stock_in / stock_out / stock_rollback） |
| `PreppedStockBatch` | 生产批次库存：批次 = 切配计划单（PPL），按净菜行追踪生产量与批次余量；总库存仍以 `PreppedStock` 为准 |
| `OutboundOrder` | 净菜出库单：`outbound_at` 是业务出库时间；新建支持生产批次（`production_plan_id` + 收货门店）或门店排程单来源，内部生产单来源仍下线。批次可拆多店多单，出库同步扣批次余量与总库存；排程出库成功后回写排程完成 |
| `OutboundOrderItem` | 出库单明细快照（含出库价与金额） |
| `Inventory` | 旧原料库存，已停用 |
| `InventoryLedger` | 旧库存流水，已停用 |

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
- `SeasoningProduct`（物理表 `standard_seasonings`）

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
5. **改完 schema 必须重启 dev server**：Next 不监听 `node_modules`，运行中的进程不会换掉 Prisma Client，新增字段在旧实例上查不出来（表现为列表/详情接口少字段）。`npm run dev` 已内置 `prisma generate`，用它启动就不会漏。
