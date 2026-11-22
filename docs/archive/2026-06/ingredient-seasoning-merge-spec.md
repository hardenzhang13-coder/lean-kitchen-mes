# 食材库原料与调料表合并需求文档

> 本文档作为 Claude Code 的完整执行需求输入，涵盖食材库底层表结构合并（原料表 + 调料表 → 统一食材表）。请按本文档描述的业务逻辑、交互规范、数据变更要求执行实现，代码层面的设计与执行由 CC 的 plan 模式自主完成。
>
> 当前系统版本：lean-kms-v3
> 涉及范围：Prisma Schema、数据库迁移、API 路由、前端页面、AI 识别、采购入库、库存管理、菜品 BOM

---

## 一、需求总览

| 编号 | 需求 | 类型 | 优先级 |
|------|------|------|--------|
| 1 | 合并 `Ingredient`（原料）与 `SeasoningIngredient`（调料）为统一 `Ingredient` 表 | 重构 | P0 |
| 2 | 统一字段命名与语义：商品名称、采购规格、采购单位、入库单位等 | 优化 | P0 |
| 3 | 废弃 `SeasoningIngredient` 表及相关独立 API 路由 | 重构 | P0 |
| 4 | 迁移关联表外键：`PurchaseReceiptItem`、`Inventory`、`InventoryLedger` | 重构 | P0 |
| 5 | 更新菜品 BOM 中调料查询逻辑（`DishSeasoningDetail`） | 修正 | P0 |
| 6 | 更新 AI 采购识别匹配逻辑 | 修正 | P0 |
| 7 | 更新前端页面：原料清单、调料清单、采购录入、库存查询 | 修正 | P0 |
| 8 | 季节限定与存储方式保留字段但不在业务界面展示 | 优化 | P1 |

---

## 二、详细需求说明

### 需求 1：合并原料与调料为统一食材表

#### 现状问题
- 系统存在两个平行的食材表：`Ingredient`（原料）和 `SeasoningIngredient`（调料），二者字段高度重合但命名不一致
- 采购入库、库存管理、AI 识别等模块需要同时查询两张表，代码冗余且容易遗漏
- 新增食材时，表单组件 `IngredientFormDialog` 需要区分 `mode="ingredient"` 和 `mode="seasoning"`，向不同 API 发送请求

#### 目标业务逻辑
- 将 `SeasoningIngredient` 的全部数据迁移到 `Ingredient` 表
- 通过 `l2Code`（二级分类编码）区分食材类型，而非通过表名区分
- 调味品体系下的二级分类（`parentCode = "SEA"` 或旧兼容 `GRA-SEA`）即为调料；其余为普通原料
- 删除 `SeasoningIngredient` 表及对应的独立 API 路由 `/api/seasoning-ingredients` 和 `/api/seasoning-ingredients/[id]`

#### 涉及范围
- `prisma/schema.prisma`
- `/app/api/seasoning-ingredients/route.ts`
- `/app/api/seasoning-ingredients/[id]/route.ts`
- 所有引用 `SeasoningIngredient` 的 API 和前端代码

#### 注意事项
- 历史数据编码前缀保留：`ING-xxx`（原料）和 `SEA-xxx`（调料）均保留，不做统一编码改造
- 新增食材时，根据所选二级分类自动判断编码前缀：调味品体系 → `SEA-xxx`，其他 → `ING-xxx`

---

### 需求 2：统一字段命名与语义

#### 现状问题
| 业务语义 | 原料表字段 | 调料表字段 |
|---------|-----------|-----------|
| 食材名称 | `name` | `name` |
| 商品名称/别名/品牌 | `alias` | `brand` |
| 采购规格 | `purchaseSpec` | `productSpec` |
| 采购单位 | `purchaseUnit` | `productUnit` |
| 最新参照单价 | `latestRefPrice` | `latestRefPrice` |
| 入库单位 | `stockUnit` | `stockUnit` |
| 零售价 | 无 | `retailPrice` |
| 采购价 | 无 | `purchasePrice` |

#### 目标业务逻辑
统一后的 `Ingredient` 表保留以下字段：

| 业务展示字段 | 数据库字段 | 说明 |
|-------------|-----------|------|
| 编号 | `code` | 保留现有编码 |
| 食材名称 | `name` | 核心名称 |
| 商品名称 | `alias` | 统一字段：原料原 `alias` 直接保留；原料原 `brand`（如有且 `alias` 为空）迁移到 `alias`；调料原 `brand` 迁移到 `alias` |
| 二级分类 | `l2Code` | 通过分类体系区分原料/调料 |
| 采购规格 | `purchaseSpec` | 统一字段，原料 `purchaseSpec` / 调料 `productSpec` 合并 |
| 采购单位 | `purchaseUnit` | 统一字段，原料 `purchaseUnit` / 调料 `productUnit` 合并 |
| 最新参照单价 | `latestRefPrice` | `Decimal?` |
| 入库单位 | `stockUnit` | `String?` |
| 季节限定 | `season` | `String` 默认"四季"，保留但不在业务界面展示 |
| 存储方式 | `storage` | `String` 默认"常温"，保留但不在业务界面展示 |
| 软删除 | `deletedAt` | `DateTime?` |

#### 废弃字段（迁移后删除）
| 字段 | 原表 | 废弃原因 | 数据迁移策略 |
|------|------|---------|-------------|
| `brand` | `Ingredient` | 与 `alias` 语义重复，统一为 `alias` | 有值且 `alias` 为空时 → `alias` |
| `unit` | `Ingredient` | 与 `stockUnit` 语义重复，统一用 `stockUnit` | 查询/展示逻辑改为 `stockUnit` |
| `priceUnit` | `Ingredient` | 与 `purchaseUnit` 语义重复，统一用 `purchaseUnit` | 查询/展示逻辑改为 `purchaseUnit` |
| `productSpec` | `SeasoningIngredient` | 统一为 `purchaseSpec` | 迁移时映射到 `purchaseSpec` |
| `productUnit` | `SeasoningIngredient` | 统一为 `purchaseUnit` | 迁移时映射到 `purchaseUnit` |
| `purchasePrice` | `SeasoningIngredient` | 菜品成本计算改用 `latestRefPrice` | 有值时迁移到 `latestRefPrice` |
| `retailPrice` | `SeasoningIngredient` | 未被业务使用 | 直接废弃 |

#### 涉及范围
- `prisma/schema.prisma`
- 所有查询/写入 `Ingredient` 或 `SeasoningIngredient` 的 API 路由
- 前端页面中的字段展示和表单提交
- Zod Schema 校验规则

---

### 需求 3：废弃 `SeasoningIngredient` 独立 API

#### 现状问题
- `/api/seasoning-ingredients`（GET/POST）和 `/api/seasoning-ingredients/[id]`（GET/PUT/DELETE）独立维护一套 CRUD
- 与 `/api/ingredients` 逻辑高度重复

#### 目标业务逻辑
- 删除 `/api/seasoning-ingredients` 和 `/api/seasoning-ingredients/[id]` 路由
- 所有调料的 CRUD 统一走 `/api/ingredients` 和 `/api/ingredients/[id]`
- `/api/ingredients` 的 GET 参数支持按 `l2Code` 过滤，不再自动排除调味品分类（移除 `notIn: seasoningL2Codes` 的硬编码过滤）
- `/api/ingredients` 的 POST 需根据 `l2Code` 自动判断编码前缀（ING- 或 SEA-）

#### 涉及范围
- `/app/api/seasoning-ingredients/*` 删除
- `/app/api/ingredients/route.ts` 增强
- `/app/api/ingredients/[id]/route.ts` 增强
- `IngredientFormDialog` 表单提交逻辑统一为 `/api/ingredients`

---

### 需求 4：迁移关联表外键

#### 现状问题
以下关联表同时持有 `ingredientId` 和 `seasoningIngredientId` 两个外键：
- `PurchaseReceiptItem`（采购明细）
- `Inventory`（库存）
- `InventoryLedger`（库存流水）

#### 目标业务逻辑
- 上述三张表删除 `seasoningIngredientId` 字段
- 所有原指向 `SeasoningIngredient` 的数据，统一改为 `ingredientId` 指向迁移后的 `Ingredient` 表记录
- **同时需要迁移 `DishSeasoningDetail`（`type = "seasoning"`）的 `sourceId`：** 该字段原指向 `SeasoningIngredient.id`，需映射到新的 `Ingredient.id`
- **同时需要迁移 `PurchasePlan`（`sourceType = "seasoning"`）的 `sourceId`：** 该字段原指向 `SeasoningIngredient.id`，需映射到新的 `Ingredient.id`
- 数据迁移顺序：
  1. 先将 `SeasoningIngredient` 数据插入 `Ingredient` 表（获得新 id）
  2. 建立 `旧 seasoningId → 新 ingredientId` 映射表
  3. 更新 `PurchaseReceiptItem`、`Inventory`、`InventoryLedger` 的 `seasoningIngredientId` → 映射后的 `ingredientId`
  4. 更新 `DishSeasoningDetail`（`type = "seasoning"`）的 `sourceId` → 映射后的 `Ingredient.id`
  5. 更新 `PurchasePlan`（`sourceType = "seasoning"`）的 `sourceId` → 映射后的 `Ingredient.id`
  6. 删除 `SeasoningIngredientId` 列（`PurchaseReceiptItem`、`Inventory`、`InventoryLedger`）
  7. 删除 `SeasoningIngredient` 表

#### 涉及范围
- `prisma/schema.prisma`
- `/app/api/purchase-receipts/route.ts`
- `/app/api/purchase-receipts/[id]/route.ts`
- `/app/api/inventory/route.ts`
- `/app/api/inventory/ledger/route.ts`
- 采购录入页面（`purchases/new/page.tsx`）中的 `seasoningIngredientId` 处理

---

### 需求 5：更新菜品 BOM 中调料查询逻辑

#### 现状问题
- `DishSeasoningDetail`（`type = "seasoning"`）的 `sourceId` 原指向 `SeasoningIngredient.id`
- `buildPurchasePlans`（`app/lib/schedule-utils.ts`）中查询调料价格时查 `SeasoningIngredient` 表
- `app/api/dishes/[id]/bom/route.ts` 中查询调料价格时查 `SeasoningIngredient.purchasePrice`

#### 目标业务逻辑
- `DishSeasoningDetail` Schema 无需修改（没有外键约束，纯逻辑关联）
- 所有查询 `SeasoningIngredient` 的地方改为查询 `Ingredient` 表
- 调料单价字段统一使用 `latestRefPrice`（替代原 `purchasePrice`）
- 排期工具 `buildPurchasePlans` 中调料查询逻辑更新
- 菜品 BOM API 中调料成本计算更新

#### 涉及范围
- `app/lib/schedule-utils.ts`
- `app/api/dishes/[id]/bom/route.ts`
- 所有涉及 `seasoningIngredient` 的查询代码

---

### 需求 6：更新 AI 采购识别匹配逻辑

#### 现状问题
- `/api/purchase-receipts/recognize/route.ts` 中同时查询 `ingredient.findMany` 和 `seasoningIngredient.findMany` 两套数据
- 匹配逻辑分"先匹配原料，再匹配调料"两阶段

#### 目标业务逻辑
- 统一查询 `Ingredient` 表，通过 `l2Code` 判断匹配到的食材属于原料还是调料
- 匹配逻辑简化为单表查询：
  - 按 `name`（食材名称）或 `alias`（商品名称）匹配
  - 匹配成功后，通过 `l2Code` 所属的 `parentCode` 判断是原料还是调料
- 返回数据结构不变（前端仍接收 `ingredientId` / `seasoningIngredientId` 区分类型，或统一改为 `ingredientId` + `category` 标识）
- 采购录入页面中 `items` 的 `seasoningIngredientId` 字段统一废弃，全部使用 `ingredientId`，通过 `l2Code` 判断类型

#### 涉及范围
- `app/api/purchase-receipts/recognize/route.ts`
- `app/purchases/new/page.tsx` 中的 `FormItem` 接口和数据处理
- `lib/schemas/purchase.ts` 中的 `purchaseReceiptItemSchema`

---

### 需求 7：更新前端页面

#### 原料清单页 (`/ingredients/raw`)
- 列表字段调整为：序号、编号、食材名称、商品名称、一级分类、二级分类、采购规格、采购单位、最新参照单价、入库单位、操作
- 移除展示：别名列（合并为商品名称）、季节限定、储存方式
- 导入模板字段同步调整：移除 `season`、`storage`，新增 `alias`（商品名称）

#### 调料清单页 (`/ingredients/seasoning`)
- 列表字段调整为：序号、编号、食材名称、商品名称、二级分类、采购规格、采购单位、最新参照单价、入库单位、操作
- 移除展示：产品品牌列（合并为商品名称）、储存方式
- 一级分类在列表中不展示（但数据上存在，通过二级分类关联）
- 调用 API 统一改为 `/api/ingredients?l2Code=...` 或按分类过滤

#### 食材新增/编辑弹窗 (`IngredientFormDialog`)
- 原料模式：显示一级分类、二级分类、食材名称、商品名称、采购规格、采购单位、入库单位、最新参照单价
- 调料模式：不显示一级分类选择器（自动锁定为"调味品"），只显示二级分类；其余字段同原料模式
- 商品名称字段：原料模式下非必填；调料模式下必填（与现状一致）
- 季节限定和储存方式：表单中不展示，提交时后端使用默认值（四季/常温）
- **前端类型 `CreatedIngredient` 更新：** 移除 `brand`、`priceUnit`、`unit` 字段，统一使用 `alias`、`purchaseUnit`、`stockUnit`
- **调料清单页 `Seasoning` 类型更新：** 移除 `brand` 和 `productSpec` 字段，统一使用 `alias` 和 `purchaseSpec`

#### 采购录入页 (`/purchases/new`)
- `FormItem` 中移除 `seasoningIngredientId` 字段，统一使用 `ingredientId`
- 食材匹配弹窗调用统一 API `/api/ingredients`
- 通过 `l2Code` 判断匹配到的食材是否为调料，展示相应的分类信息

#### 库存查询页 (`/inventory`)
- 移除 `seasoningIngredient` 关联查询，统一通过 `ingredient` 关联
- 列表展示字段同步调整

#### 库存流水页 (`/inventory/ledger`)
- 移除 `seasoningIngredient` 关联查询，统一通过 `ingredient` 关联

---

### 需求 8：季节限定与存储方式保留但不展示

#### 目标业务逻辑
- `season` 和 `storage` 字段在 `Ingredient` 表中保留，有默认值
- 所有前端表单中不再展示这两个字段
- 所有列表中不再展示这两个字段
- 导入/导出模板中不再包含这两个字段
- 后端 API 接收时，如前端未传，使用默认值（"四季"、"常温"）

---

## 三、数据模型变更

### 1. `Ingredient` 表（统一后）

| 字段名 | 类型 | 属性 | 说明 |
|--------|------|------|------|
| `id` | Int | @id @default(autoincrement()) | 主键 |
| `code` | String | @unique | 编码：ING-xxx 或 SEA-xxx |
| `name` | String | | 食材名称 |
| `alias` | String? | | 商品名称（原料别名/调料品牌统一） |
| `l2Code` | String | @map("l2_code") | 二级分类编码 |
| `purchaseSpec` | String? | @map("purchase_spec") | 采购规格 |
| `purchaseUnit` | String? | @map("purchase_unit") | 采购单位 |
| `stockUnit` | String? | @map("stock_unit") | 入库单位 |
| `latestRefPrice` | Decimal? | @db.Decimal(10,2) @map("latest_ref_price") | 最新参照单价 |
| `season` | String | @default("四季") | 季节限定，保留不展示 |
| `storage` | String | @default("常温") | 存储方式，保留不展示 |
| `deletedAt` | DateTime? | @map("deleted_at") | 软删除 |

**废弃字段（从原 `Ingredient` 删除）：** `unit`、`priceUnit`、`brand`

**新增字段（从 `SeasoningIngredient` 迁移）：** 无新增，字段已覆盖

### 2. `SeasoningIngredient` 表

**删除整张表。**

数据迁移映射：
| 原字段 | 目标字段 | 迁移规则 |
|--------|---------|---------|
| `id` | `id` | 新插入生成新 id，建立旧 id → 新 id 映射 |
| `code` | `code` | 保留原 SEA-xxx 编码 |
| `name` | `name` | 直接复制 |
| `brand` | `alias` | 调料 brand → 统一 alias |
| `l2Code` | `l2Code` | 直接复制 |
| `productSpec` | `purchaseSpec` | 改名映射 |
| `productUnit` | `purchaseUnit` | 改名映射 |
| `purchaseUnit` | `purchaseUnit` | 直接复制（如 productUnit 有值优先用 productUnit） |
| `stockUnit` | `stockUnit` | 直接复制 |
| `latestRefPrice` | `latestRefPrice` | 直接复制 |
| `purchasePrice` | `latestRefPrice` | 如 `latestRefPrice` 为空，用 `purchasePrice` 填充 |
| `storage` | `storage` | 直接复制 |
| `deletedAt` | `deletedAt` | 直接复制 |

### 3. 关联表变更

#### `PurchaseReceiptItem`
- **删除字段：** `seasoningIngredientId`（`seasoning_ingredient_id`）
- **保留字段：** `ingredientId`（`ingredient_id`）——已足以承载原料和调料

#### `Inventory`
- **删除字段：** `seasoningIngredientId`（`seasoning_ingredient_id`）
- **保留字段：** `ingredientId`（`ingredient_id`）——已足以承载原料和调料
- **唯一约束调整：** 原 `ingredientId` @unique 和 `seasoningIngredientId` @unique 各为独立唯一约束，合并后 `ingredientId` 保持唯一
- **查询逻辑变更：** `GET /api/inventory` 中 `unit` 的 fallback 从 `ingredient.unit` 改为 `ingredient.stockUnit`

#### `InventoryLedger`
- **删除字段：** `seasoningIngredientId`（`seasoning_ingredient_id`）
- **保留字段：** `ingredientId`（`ingredient_id`）——已足以承载原料和调料

### 4. 其他不受影响但需更新查询的表

- `DishSeasoningDetail`：Schema 无变化（无外键），但 **迁移时需更新 `sourceId`（`type = "seasoning"`）指向新的 `Ingredient.id`**；查询逻辑中 `type="seasoning"` 时从查 `SeasoningIngredient` 改为查 `Ingredient`
- `PurchasePlan`：Schema 无变化，但 **迁移时需更新 `sourceId`（`sourceType = "seasoning"`）指向新的 `Ingredient.id`**；查询逻辑中 `sourceType="seasoning"` 时从查 `SeasoningIngredient` 改为查 `Ingredient`
- `NetIngredient`、`MinorIngredient`、`SauceIngredient`：不受影响

---

## 四、API 接口变更

### 1. 删除的 API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/seasoning-ingredients` | GET, POST | 删除，调料统一走 `/api/ingredients` |
| `/api/seasoning-ingredients/[id]` | GET, PUT, DELETE | 删除，调料统一走 `/api/ingredients/[id]` |

### 2. 变更的 API 路由

#### `GET /api/ingredients`
- **变更：** 移除 `notIn: seasoningL2Codes` 的硬编码过滤，改为根据请求参数 `l2Code` 过滤
- **查询参数：** 保留 `l2Code`（可选），返回对应二级分类下的食材
- **前端调用：** 原料页不传 `l2Code` 或传入非调味品分类；调料页传入调味品分类的 `l2Code`

#### `POST /api/ingredients`
- **变更：** 根据 `l2Code` 自动判断编码前缀
  - 如果 `l2Code` 属于调味品体系（`parentCode = "SEA"` 或 `code = "GRA-SEA"`），编码前缀为 `SEA-`
  - 否则编码前缀为 `ING-`
- **编码生成实现：** 查询 `Ingredient` 表中同前缀的最后一条记录，按序号自增。如 `SEA-` 前缀的调料，查 `code` 以 `SEA-` 开头的最大序号 +1；`ING-` 前缀同理。
- **请求字段变更：** 废弃 `brand`、`unit`、`priceUnit`，统一用 `alias`、`purchaseUnit`、`stockUnit`
- **响应结构：** 不变，返回创建后的 `Ingredient` 对象
- **Zod Schema 更新（`lib/schemas/ingredient.ts`）：** `createIngredientSchema` 中移除 `unit`、`priceUnit`、`brand` 字段，保留 `alias`、`purchaseUnit`、`stockUnit`

#### `PUT /api/ingredients/[id]`
- **变更：** 废弃 `brand`、`unit`、`priceUnit`，统一用 `alias`、`purchaseUnit`、`stockUnit`
- **响应结构：** 不变

#### `DELETE /api/ingredients/[id]`
- 无逻辑变更（保持软删除）

#### `POST /api/ingredients/import`
- **变更：** 导入模板字段调整，移除 `season`、`storage`，新增 `alias`
- 导入逻辑只插入 `Ingredient` 表
- `season` 和 `storage` 使用默认值（"四季"、"常温"），不在导入模板中要求
- 名称查重逻辑：移除 `existingSeasonings` 查询，只查 `Ingredient` 表（含原调料数据）

#### `POST /api/purchase-receipts/recognize`
- **变更：** 统一查询 `Ingredient` 表，移除 `seasoningIngredient.findMany`
- 查询 `select` 字段调整：移除 `unit`、`priceUnit`、`brand`；保留 `id, name, alias, l2Code, purchaseUnit, stockUnit, storage, purchaseSpec`
- 匹配逻辑：按 `name` 或 `alias` 匹配（不再区分原料/调料表）
- 匹配成功后通过 `l2Code` 的 `parentCode` 判断是原料还是调料
- 返回字段：移除 `seasoningIngredientId`，统一使用 `ingredientId`；通过 `category` 或 `l2Code` 告知前端是原料还是调料
- `brand` 字段的填充来源：从 `ingMatch.brand` 或 `seaMatch.brand` 统一改为 `ingMatch.alias`

#### `POST /api/purchase-receipts` 与 `PUT /api/purchase-receipts/[id]`
- **变更：** `items` 中移除 `seasoningIngredientId`，统一使用 `ingredientId`
- **Zod Schema 更新（`lib/schemas/purchase.ts`）：** `purchaseReceiptItemSchema` 中移除 `seasoningIngredientId` 字段
- 入库逻辑：只判断 `ingredientId`，通过 `l2Code` 判断是否需要更新 `latestRefPrice`（所有食材都更新）

#### `GET /api/inventory`
- **变更：** 移除 `seasoningIngredient` 关联查询，统一通过 `ingredient` 关联
- 返回字段：`sourceType` 不再需要，或改为通过 `l2Code` 判断类型

#### `GET /api/inventory/ledger`
- **变更：** 移除 `seasoningIngredient` 关联查询，统一通过 `ingredient` 关联

#### `GET /api/purchase-receipts` 与 `GET /api/purchase-receipts/[id]`
- **变更：** `items` 的 `include` 中移除 `seasoningIngredient`，统一通过 `ingredient` 获取关联信息

#### `POST /api/dishes/[id]/bom`（菜品 BOM 更新）
- **变更：** 查询调料时从 `tx.seasoningIngredient.findMany` 改为 `tx.ingredient.findMany`（筛选调味品分类的 `l2Code`）
- 单价字段从 `purchasePrice` 改为 `latestRefPrice`

#### `buildPurchasePlans`（`app/lib/schedule-utils.ts`）
- **变更：** 查询调料时从 `tx.seasoningIngredient.findMany` 改为 `tx.ingredient.findMany`（筛选调味品分类的 `l2Code`）
- 单价字段从 `purchasePrice` 改为 `latestRefPrice`
- `purchaseSpec` 从 `productSpec` 改为 `purchaseSpec`
- `priceUnit` 从 `purchaseUnit` 改为 `purchaseUnit`（字段已统一）
- **原料相关字段来源变更：** `ingredientMap` 中的 `unit` 从 `src.unit` 改为 `src.stockUnit` 或 `src.purchaseUnit`；`priceUnit` 从 `src.priceUnit` 改为 `src.purchaseUnit`

---

## 五、交互设计与页面规范

### 原料清单页 (`/ingredients/raw`)

**列表字段顺序（从左到右）：**
1. 序号
2. 编号
3. 食材名称
4. 商品名称
5. 一级分类
6. 二级分类
7. 采购规格
8. 采购单位
9. 最新参照单价
10. 入库单位
11. 操作

**筛选器：**
- 一级分类 TileSelect（与现状一致）
- 二级分类 TileSelect（与现状一致）
- 搜索框（支持名称、编号、商品名称搜索）

### 调料清单页 (`/ingredients/seasoning`)

**列表字段顺序（从左到右）：**
1. 序号
2. 编号
3. 食材名称
4. 商品名称
5. 二级分类
6. 采购规格
7. 采购单位
8. 最新参照单价
9. 入库单位
10. 操作

> 注意：一级分类在列表中不展示列（数据上通过二级分类关联，列表中省略该列）

**筛选器：**
- 搜索框（支持名称、编号、商品名称搜索）
- 可选：二级分类筛选（只显示调味品下的子分类）

### 食材新增/编辑弹窗 (`IngredientFormDialog`)

#### 原料模式
**表单字段顺序：**
1. 一级分类（TileSelect，必填）
2. 二级分类（TileSelect，必填，依赖一级分类）
3. 食材名称（Input，必填）
4. 商品名称（Input，非必填）
5. 采购规格（Input，必填）
6. 采购单位（SearchableSelect，必填）
7. 入库单位（SearchableSelect，必填）
8. 最新参照单价（Number Input，可选）

#### 调料模式
**表单字段顺序：**
1. 二级分类（TileSelect，必填，只展示调味品下的子分类）
2. 食材名称（Input，必填）
3. 商品名称（Input，必填）
4. 采购规格（Input，必填）
5. 采购单位（SearchableSelect，必填）
6. 入库单位（SearchableSelect，必填）
7. 最新参照单价（Number Input，可选）

> 注意：一级分类在调料表单中不显示（但后端数据上通过二级分类的 parent 关联，自动归属为"调味品"）

#### 右侧已添加列表
- 显示字段：名称、商品名称、采购规格、采购单位、入库单位、最新参照单价
- 原料模式额外显示：季节限定（**不显示，从需求 8 移除展示**）
- 调料模式不显示季节限定
- 储存方式不显示

### 采购录入页 (`/purchases/new`)

**表格字段：**
1. 食材名称
2. 商品名称
3. 采购规格
4. 数量
5. 采购单位
6. 单价
7. 金额
8. 入库单位
9. 入库数量
10. 操作

- 移除：储存方式列
- 食材匹配逻辑：点击匹配时弹窗统一调用 `/api/ingredients`（通过分类过滤），不再区分原料/调料弹窗
- `FormItem` 中移除 `seasoningIngredientId`，统一使用 `ingredientId`

### 库存查询页 (`/inventory`)

**列表字段：**
1. 编号
2. 食材名称
3. 一级分类
4. 二级分类
5. 当前库存
6. 单位
7. 更新时间

- 移除 `sourceType` 列（不再区分原料/调料，统一展示）

---

## 六、技术约束与红线

### 数据库迁移约束
- **必须使用 `prisma migrate dev`** 生成迁移文件，**禁止 `prisma db push`**
- 迁移需分阶段：Schema 变更 → 数据迁移脚本 → 关联表更新 → 废弃字段/表删除
- 数据迁移脚本必须保证：如 `SeasoningIngredient` 的 `purchasePrice` 有值但 `latestRefPrice` 为空，迁移时填充
- 迁移完成后，旧 `SeasoningIngredient` 的 id 不能再被任何代码引用

### 代码约束
- 禁止新增 `any` 类型
- 禁止无分页的列表 API（当前已有分页的保持，新 API 必须分页）
- 输入校验必须使用 Zod Schema
- 事务内操作使用 `prisma.$transaction`
- 操作日志继续使用 `logOperation`
- 代码提交前检查顺序：`npx tsc --noEmit` → `npm run build` → `npm run lint`

### 兼容性约束
- 保留 `ING-xxx` 和 `SEA-xxx` 编码前缀，不强制统一
- 前端 URL 路由 `/ingredients/raw` 和 `/ingredients/seasoning` 保持不变（用户侧书签/导航不受影响）
- 采购录入页面的 `FormItem` 数据结构如有变更，需确保编辑历史采购单时的兼容性

### 回滚策略
- 迁移前备份数据库
- 迁移脚本应可重复执行（幂等）
- 如果迁移失败，需能通过 Prisma migration 回滚

---

## 七、验收标准

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 1 | 数据库 Schema | `prisma/schema.prisma` 中只存在 `Ingredient` 食材表，无 `SeasoningIngredient` 表；关联表无 `seasoningIngredientId` 字段 | `npx prisma generate` 成功 + `prisma migrate status` 检查 |
| 2 | 数据完整性 | 原 `SeasoningIngredient` 数据全部迁移到 `Ingredient` 表；`PurchaseReceiptItem`、`Inventory`、`InventoryLedger`、`DishSeasoningDetail`（`type="seasoning"`）、`PurchasePlan`（`sourceType="seasoning"`）的关联正确映射 | 数据库直接查询对比记录数 |
| 3 | 编码规则 | 新增调味品分类食材时，编码前缀为 `SEA-`；新增其他分类食材时，编码前缀为 `ING-` | 前端新增 + 数据库验证 |
| 4 | 原料 CRUD | 原料清单增删改查正常，列表字段符合规范（无季节限定、无储存方式展示） | 功能测试 |
| 5 | 调料 CRUD | 调料清单增删改查正常，列表字段符合规范（无一级分类列、无储存方式展示） | 功能测试 |
| 6 | 表单规范 | 原料表单显示一级分类；调料表单不显示一级分类；两者都不显示季节限定和储存方式 | 功能测试 |
| 7 | 采购识别 | AI 采购识别只查询一张表，匹配结果正确；采购录入后入库正常 | 功能测试 + 查看库存 |
| 8 | 采购单编辑 | 历史采购单（含原调料数据）编辑正常，入库/作废逻辑正确 | 功能测试 |
| 9 | 库存查询 | 库存列表显示所有食材（原料+调料），sourceType 列已移除或统一展示 | 功能测试 |
| 10 | 库存流水 | 库存流水查询正常，只关联 `Ingredient` 表 | 功能测试 |
| 11 | 菜品 BOM | 菜品调料成本计算正常，使用 `latestRefPrice` 而非 `purchasePrice` | 创建/编辑菜品 → 查看成本 |
| 12 | 排期计划 | 排期生成采购计划时，调料查询 `Ingredient` 表，单价正确 | 创建排期 → 查看采购计划 |
| 13 | 名称查重 | 新增食材时，名称查重跨全 `Ingredient` 表（含原调料数据），不区分原表 | 功能测试 |
| 14 | 类型检查 | `npx tsc --noEmit` 通过，无类型错误 | 命令行执行 |
| 15 | 构建检查 | `npm run build` 通过 | 命令行执行 |
| 16 | 代码规范 | `npm run lint` 通过（或允许现有 warning，不新增 error） | 命令行执行 |

---

## 八、相关文件参考

以下文件在改造过程中需要重点参考，CC 可根据实际情况调整修改范围：

### Schema 与数据层
- `prisma/schema.prisma` — 数据库 Schema 定义
- `prisma/migrate-gra-sea-to-seasoning.ts` — 历史迁移脚本参考（旧兼容分类迁移）

### API 路由
- `app/api/ingredients/route.ts` — 原料 CRUD（需扩展为统一食材 API）
- `app/api/ingredients/[id]/route.ts` — 原料详情/更新/删除
- `app/api/ingredients/import/route.ts` — 批量导入
- `app/api/ingredients/check-name/route.ts` — 名称查重（跨表查重逻辑需更新，移除 `excludeTable` 的 `seasoning_ingredients` 支持）
- `app/api/seasoning-ingredients/route.ts` — **删除目标**
- `app/api/seasoning-ingredients/[id]/route.ts` — **删除目标**
- `app/api/purchase-receipts/route.ts` — 采购单 CRUD（含入库逻辑）
- `app/api/purchase-receipts/[id]/route.ts` — 采购单详情/编辑/作废
- `app/api/purchase-receipts/recognize/route.ts` — AI 采购识别
- `app/api/inventory/route.ts` — 库存查询
- `app/api/inventory/ledger/route.ts` — 库存流水
- `app/api/dishes/[id]/bom/route.ts` — 菜品 BOM 更新
- `app/api/ingredient-categories/route.ts` — 分类查询（无变化，但查询逻辑可能依赖）

### 工具与 Schema
- `lib/schemas/ingredient.ts` — 原料 Zod Schema
- `lib/schemas/purchase.ts` — 采购 Zod Schema
- `lib/category-helpers.ts` — 调味品分类判断工具（`getSeasoningL2Codes`）
- `lib/duplicate-check.ts` — 名称查重（跨表查重逻辑需更新）
- `app/lib/schedule-utils.ts` — 排期工具（`buildPurchasePlans`、`buildCuttingOrders`）

### 前端页面与组件
- `app/ingredients/page.tsx` — 食材库入口
- `app/ingredients/raw/page.tsx` — 原料清单页
- `app/ingredients/seasoning/page.tsx` — 调料清单页
- `app/components/ingredient-form-dialog.tsx` — 食材表单弹窗（核心组件）
- `app/purchases/new/page.tsx` — 采购录入页（1471 行，核心页面）
- `app/purchases/page.tsx` — 采购列表
- `app/inventory/page.tsx` — 库存查询
- `app/inventory/ledger/page.tsx` — 库存流水
- `app/dishes/page.tsx` — 菜品列表
- `app/dishes/[id]/page.tsx` — 菜品详情
- `app/components/dish-create-wizard.tsx` — 菜品创建向导

---

## 九、执行建议（供 CC 参考）

本需求为底层表结构重构，建议按以下阶段执行：

### Phase 1：Schema 迁移
1. 备份数据库
2. 编写 Prisma Migration 脚本（分步骤）：
   - 在 `Ingredient` 表确认所有目标字段存在
   - 将 `SeasoningIngredient` 数据迁移到 `Ingredient`（生成旧 id → 新 id 映射）
   - 更新 `PurchaseReceiptItem`、`Inventory`、`InventoryLedger` 的 `seasoningIngredientId` → `ingredientId`
   - 删除 `SeasoningIngredient` 表
   - 清理 `Ingredient` 废弃字段（`unit`、`priceUnit`、`brand`）
3. 运行 `prisma migrate dev` 并验证

### Phase 2：API 路由改造
1. 删除 `/api/seasoning-ingredients/*` 路由
2. 扩展 `/api/ingredients/*` 为统一食材 API（支持编码前缀自动判断）
3. 更新 `/api/purchase-receipts/*` 中的关联查询和入库逻辑
4. 更新 `/api/inventory/*` 移除 `seasoningIngredient` 关联
5. 更新 `/api/purchase-receipts/recognize` 为单表匹配
6. 更新 `/api/dishes/[id]/bom` 和 `app/lib/schedule-utils.ts` 的调料查询逻辑

### Phase 3：前端改造
1. 更新 `IngredientFormDialog`：统一表单、调料模式隐藏一级分类、隐藏 season/storage
2. 更新 `/ingredients/raw` 和 `/ingredients/seasoning` 列表字段
3. 更新 `/purchases/new` 移除 `seasoningIngredientId`、统一匹配逻辑
4. 更新 `/inventory` 和 `/inventory/ledger` 查询逻辑

### Phase 4：验证
1. `npx tsc --noEmit`
2. `npm run build`
3. `npm run lint`
4. 功能验证（按验收标准逐项测试）
