# 排程 API（app/api/schedules）

本目录提供生产排程的创建、查询、修改、状态流转。排程是驱动切配工单和采购计划生成的核心业务入口。

## 路由结构

| 文件 | 端点 | 用途 |
|------|------|------|
| `route.ts` | `GET /api/schedules` / `POST /api/schedules` | 列表查询、创建排程 |
| `[id]/route.ts` | `GET /api/schedules/[id]` / `PUT /api/schedules/[id]` / `DELETE /api/schedules/[id]` | 详情、修改、删除 |
| `[id]/activate/route.ts` | `PUT /api/schedules/[id]/activate` | 确认生产（待生效 → 进行中） |
| `[id]/void/route.ts` | `PUT /api/schedules/[id]/void` | 作废（进行中 → 待生效，恢复可编辑） |
| `active/route.ts` | `GET /api/schedules/active` | 查询所有"进行中"排程 |

> 完成生产**不在这里**：排程的「进行中 → 已完成」由生产计划单完成时通过
> `lib/server/production-plan-assignment.ts` 的 `syncSourceScheduleStatuses()` 回写。
> 旧的 `PUT /api/schedules/[id]/complete` 会绕过净菜入库事务，已于 2026-11-16 删除。

## 状态机

```
待生效 ──确认生产──> 进行中 ──生产计划单完成生产──> 已完成
   ↑                   │
   └────── 作废 ────────┘
```

- **待生效** — 可修改、可删除、可确认
- **进行中** — 不可修改删除；可纳入生产计划单（一张进行中排程只能归属一张未删除的计划单）；可作废回退待生效——但已有切配完成记录（工单非 pending）或已纳入未删除切配计划单时服务端拦截
- **已完成** — 终态，只能由生产计划单完成后回写

## 创建排程

`POST /api/schedules` 流程：

1. 校验请求体（`createScheduleSchema`）
2. 在 Prisma `$transaction` 中：
   - 创建 `Schedule`
   - 批量创建 `ScheduleItem`
   - 调用 `buildCuttingOrders()` 生成切配工单数据并创建 `CuttingOrder`
   - 调用 `getSeasoningL2Codes()` 获取调料分类
   - 调用 `buildPurchasePlans()` 生成采购计划数据并创建 `PurchasePlan`
3. 记录 `OperationLog`

> 所有子资源必须在同一个事务中创建，保证排程与切配/采购数据一致。

## 列表查询

`GET /api/schedules` 支持：

- `status` — 按状态筛选
- `startDate` / `endDate` — 按**生产日期**（`scheduleDate`）筛选
- `q` — 按标题 / 单号（code）/ 门店名 / 菜品名搜索（OR 匹配）
- `storeId` — 按门店筛选
- `availableForPlan` / `excludePlanId` — 生产计划单选择来源排程时使用
- `page` / `pageSize` — 分页

响应会附加 `totalQuantity`（总份数）和 `dishCount`（菜品种数）；排序为 `scheduleDate` 倒序、`createdAt` 倒序。

## 详情查询

`GET /api/schedules/[id]` 返回：

- 排程基础信息
- `items` 及关联菜品
- `cuttingOrders` 切配工单（补充分类名称）
- `purchasePlans` 采购计划（补充分类名称）

## 修改排程

`PUT /api/schedules/[id]` 限制：

- 只有"待生效"排程可修改
- 如果菜品清单变更，事务内会：
  1. 删除旧的 `ScheduleItem`、`CuttingOrder`、`PurchasePlan`
  2. 重新创建 `ScheduleItem`
  3. 重新调用 `buildCuttingOrders()` 和 `buildPurchasePlans()` 生成新数据

基础信息（门店、售卖日期）可单独更新；**标题是派生字段**，由服务端按「门店 · 周几（月日）·菜单」重算，客户端传值会被忽略。

## 删除排程

`DELETE /api/schedules/[id]` 限制：

- 只有"待生效"排程可删除
- 删除为物理删除，会级联删除 `ScheduleItem`、`CuttingOrder`、`PurchasePlan`

## 状态流转接口

### 确认生产

`PUT /api/schedules/[id]/activate`

- 将 `"待生效"` 改为 `"进行中"`
- 仅允许待生效状态调用

### 确认生产

`PUT /api/schedules/[id]/activate`

- 将 `"待生效"` 改为 `"进行中"`，事务内行锁
- 仅允许待生效状态调用

### 查询进行中排程

`GET /api/schedules/active`

- 返回所有 `status === "进行中"` 的排程
- 用于首页或看板展示

## 核心算法调用点

本目录是 `lib/server/schedule-utils.ts` 的核心调用方：

- `buildCuttingOrders(tx, scheduleId, items)` — 按菜品份数汇总净料/小料需求
- `buildPurchasePlans(tx, scheduleId, items, seasoningL2Codes)` — 汇总原料（含小料按出成率折算）/调料/酱料需求并扣除库存。小料自 2026-11 起与净料同口径，采购计划按来源原料聚合毛需求，不再生成独立小料采购行

## 注意事项

- 排程修改时采用"先删后建"策略，会丢失切配工单和采购计划的实际执行数据（`actualQty`、`actualPurchase` 等），目前业务上仅在"待生效"阶段修改，无此问题。
- 创建和修改的事务较大，包含多次查询与批量写入，高并发下注意数据库性能。
- 调料分类通过 `lib/category-helpers.ts` 的 `getSeasoningL2Codes()` 动态获取，确保采购计划只生成到调料分类下的食材。
- 前端主要调用方：`app/schedules/` 页面及详情页。
