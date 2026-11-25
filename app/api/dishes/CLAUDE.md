# 菜品 API（app/api/dishes）

本目录提供菜品档案的 REST API：列表/创建/详情/更新/删除，以及 BOM、工序两个子资源。

## 路由结构

| 文件 | 端点 | 用途 |
|------|------|------|
| `route.ts` | `GET /api/dishes` / `POST /api/dishes` | 列表查询、创建菜品 |
| `[id]/route.ts` | `GET /api/dishes/[id]` / `PUT /api/dishes/[id]` / `DELETE /api/dishes/[id]` | 详情、更新、删除 |
| `[id]/bom/route.ts` | `PUT /api/dishes/[id]/bom` | 保存 BOM 并重新计算菜品成本 |
| `[id]/processes/route.ts` | `PUT /api/dishes/[id]/processes` | 保存加工工艺 |
| `[id]/status/route.ts` | `POST /api/dishes/[id]/status` | 发布 / 下架 / 停用 / 恢复发布 |
| `[id]/scale/route.ts` | `POST /api/dishes/[id]/scale` | 按目标份量转化生成独立草稿档案，并同步净料/小料规格 |
| `[id]/scale/preview/route.ts` | `POST /api/dishes/[id]/scale/preview` | 转化前预览净料/小料规格匹配与缺失清单 |
| `[id]/copy/route.ts` | `POST /api/dishes/[id]/copy` | 复制现有菜品为独立草稿档案 |

## 列表查询

`GET /api/dishes` 支持分页与筛选：

- `categoryId` — 菜品分类
- `cuisine` — 菜系
- `technique` — 做法
- `meatType` — 荤素类型
- `portion` — 份量规格
- `portionGroup` — 份量分组：值为份量档案（`portion_profiles`）的 `scenario`（如 `单人份` / `社区` / `团餐食堂`）；服务端按该场景下启用中的档案行取 `portion` 集合做 IN 过滤，场景无档案行时返回空集
- `status` — 状态（draft / published / inactive）
- `q` — 按名称或编码模糊搜索
- `page` / `pageSize` — 分页

返回 `ApiList<Dish>` 结构，操作人用户名会被解析为姓名。

## 创建菜品

`POST /api/dishes` 流程：

1. 校验请求体（`createDishSchema`；`categoryId` 可空）
2. 有分类时查询 `DishCategory` 获取分类编码；无分类使用 `GEN` 前缀
3. 在 Serializable 事务中生成编码并创建菜品
4. 编码生成失败（唯一键冲突）时最多重试 3 次
5. 记录 `OperationLog`

### 编码生成算法

```
DSH-{categoryCode}-{0001}    // 未分类：DSH-GEN-0001
```

按 `code startsWith DSH-{categoryCode}-` 取字典序最后一条，解析序号后 +1，不足 4 位补零。复制/转化同样沿用该规则，源菜品无分类时使用 `GEN`。

## 详情查询

`GET /api/dishes/[id]` 返回完整菜品对象，包含：

- 基础信息 + 分类
- `netDetails`（主料/辅料）及关联净料
- `minorDetails`（小料）及关联净料
- `seasoningDetails`（调料）双口径：`specId` 行 = 调料产物（补全 `packageSpec` / `outPricePerJin`（回写 `pricePerJin` 字段）/ `standardPackagePrice` / `productType` / `sourceMode`）；`sourceId` 行 = 存量旧口径直引调味品原料（补全名称、采购规格与每斤单价）。克需求原样返回
- `sauceDetails`（酱料）及关联酱料
- `processes` 工序，按 stage、stepNo 排序

## 更新菜品

`PUT /api/dishes/[id]` 限制：

- 只有草稿（`draft`）可编辑；已发布（`published`）与已停用（`inactive`）均锁定，需先下架为草稿
- 不接受 `status` 写入；状态流转统一走 `POST /api/dishes/[id]/status`
- 成本不接受客户端写入，由 BOM 保存时重新计算

## 删除菜品

`DELETE /api/dishes/[id]` 限制：

- 已发布菜品不可删除
- 被排程引用（`ScheduleItem`）时返回 409，并提示改为停用
- 删除为物理删除，会级联删除 `DishNetDetail`、`DishMinorDetail`、`DishSeasoningDetail`、`DishSauceDetail`、`DishProcess`

## 保存 BOM

`PUT /api/dishes/[id]/bom`

1. 校验已发布状态，拒绝修改
2. 事务内先清空旧明细
3. 净料/小料的 `amountG` 由服务端按档案 `packageSpec` 覆盖（客户端值不参与计算），并校验引用存在、分类匹配（主料/辅料不能是小料分类，小料必须是 MIN 分类）
3.1 调料行双口径（2026-11-25 调味品升级）：`specId` 行 = 调料产物（SeasoningProduct），校验产物存在且未删除，成本 = 产物实时派生出库价 × 克需求 ÷ 500，写库时 `sourceId` 置 0 哨兵；`sourceId` 行 = 存量旧口径直引调味品原料（仅存量客户端回传，校验 `kind="seasoning"`），成本 = 每斤单价 × 克需求 ÷ 500。两者同传时以 `specId` 为准；克需求均由客户端填写，服务端不覆盖
4. 查询各食材最新单价，按 `unitPrice * amountG / 1000` 重新计算每条明细成本
5. 批量创建新明细
6. 重新汇总菜品总成本 `Dish.cost`

BOM 数据包含四层：

- `netDetails` — 主料/辅料
- `minorDetails` — 小料
- `seasoningDetails` — 调料
- `sauceDetails` — 酱料

## 保存工序

`PUT /api/dishes/[id]/processes`

1. 校验非草稿状态（已发布/已停用），拒绝修改
2. 事务内删除旧工序，批量创建新工序
3. 工序字段：`stage`（初加工/预处理/上灶加工/出锅成品）、`stepNo`、`object`、`action`、`description`、`tool`、`standard`

## 菜品转化

`POST /api/dishes/[id]/scale`，body `{ portion, name?, specs? }`

1. 任意份量档案行都可作为源；目标份量必须命中启用中的份量档案（`portion_profiles`）且与源不同
2. 倍率新口径 = 目标行 `multiplier` ÷ 源行 `multiplier`（`portionScaleFactor(source, target, profiles)`，档案行由 `lib/server/portion-profile-utils.ts` 查表注入）
3. 同步转化 BOM 引用的净料/小料：
   - 食材库已有「同来源原料 + 目标份量 + 同分类」规格 → 直接复用
   - 没有 → 按倍率推导封装规格，读取 `specs` 中用户确认的值自动建档
4. 缺失规格的预览与编辑由 `POST /api/dishes/[id]/scale/preview` 提供
5. 名称默认沿用源菜品名称，份量由 `portion` 字段区分；可由 `name` 覆盖。同类别、同名、同份量已存在时返回 409
6. 复制四层 BOM 与工序，用量/成本/售价按倍率缩放；成本以当前食材价重算后再缩放
7. 生成独立草稿档案，不建立来源关联，源档案不受影响

## 菜品复制

`POST /api/dishes/[id]/copy`，body `{ name? }`

1. 复制是新建动作：BOM、工序、售价原样保留，`factor = 1`
2. 默认名称「源名称-副本」
3. 菜品编号唯一，名称不参与唯一校验；同名档案允许存在
4. 生成独立草稿档案，源档案不受影响

## 状态生命周期

```
draft ──发布──> published ──停用──> inactive
  ^                │                 │
  └────下架────────┴────恢复发布─────┘
```

- 只有草稿可编辑；发布与恢复发布由服务端校验（名称、荤素类型、售价、主料）
- 类别、菜系、做法、口味不参与发布校验，可留空；辅料等其余用料不强制
- 停用后不出现在新建排程的可选菜品中；历史排程、生产计划快照与销售回录保留
- 状态流转接口：`POST /api/dishes/[id]/status`，body `{ action: "publish" | "unpublish" | "deactivate" | "restore" }`
- `pending` 状态已废弃，存量由迁移 `20261115233000_normalize_dish_status_pending` 归一到 `draft`

## 校验 Schema

- `createDishSchema` / `updateDishSchema` / `dishQuerySchema` / `scaleDishSchema`：`lib/server/schemas/dish.ts`
- `dishBomSchema`：`lib/schemas/dish-bom.ts`
- `dishProcessSchema`：`lib/schemas/dish-process.ts`

## 注意事项

- 所有写操作均记录 `OperationLog`。
- 创建菜品时的事务隔离级别为 `Serializable`，用于避免高并发下编码重复。
- 前端 `app/components/dish-form/` 是这些 API 的主要调用方。
