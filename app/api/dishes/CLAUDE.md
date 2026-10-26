# 菜品 API（app/api/dishes）

本目录提供菜品档案的 REST API：列表/创建/详情/更新/删除，以及 BOM、工序两个子资源。

## 路由结构

| 文件 | 端点 | 用途 |
|------|------|------|
| `route.ts` | `GET /api/dishes` / `POST /api/dishes` | 列表查询、创建菜品 |
| `[id]/route.ts` | `GET /api/dishes/[id]` / `PUT /api/dishes/[id]` / `DELETE /api/dishes/[id]` | 详情、更新、删除 |
| `[id]/bom/route.ts` | `PUT /api/dishes/[id]/bom` | 保存 BOM 并重新计算菜品成本 |
| `[id]/processes/route.ts` | `PUT /api/dishes/[id]/processes` | 保存加工工艺 |

## 列表查询

`GET /api/dishes` 支持分页与筛选：

- `categoryId` — 菜品分类
- `cuisine` — 菜系
- `meatType` — 荤素类型
- `status` — 状态（draft / pending / published）
- `q` — 按名称或编码模糊搜索
- `page` / `pageSize` — 分页

返回 `ApiList<Dish>` 结构，操作人用户名会被解析为姓名。

## 创建菜品

`POST /api/dishes` 流程：

1. 校验请求体（`createDishSchema`）
2. 查询 `DishCategory` 获取分类编码
3. 在 Serializable 事务中生成编码并创建菜品
4. 编码生成失败（唯一键冲突）时最多重试 3 次
5. 记录 `OperationLog`

### 编码生成算法

```
DSH-{categoryCode}-{0001}
```

按 `code startsWith DSH-{categoryCode}-` 取字典序最后一条，解析序号后 +1，不足 4 位补零。

## 详情查询

`GET /api/dishes/[id]` 返回完整菜品对象，包含：

- 基础信息 + 分类
- `netDetails`（主料/辅料）及关联净料
- `minorDetails`（小料）及关联净料
- `seasoningDetails`（调料），通过 `getSeasoningL2Codes()` 查询 `Ingredient` 补全名称和价格
- `sauceDetails`（酱料）及关联酱料
- `processes` 工序，按 stage、stepNo 排序

## 更新菜品

`PUT /api/dishes/[id]` 限制：

- 已发布（`published`）菜品不允许修改基础信息、成本或再次发布
- 只能将已发布菜品的状态改为 `draft`（即"下架"）
- 下架后可重新编辑 BOM 和工序

## 删除菜品

`DELETE /api/dishes/[id]` 限制：

- 已发布菜品不可删除
- 删除为物理删除，会级联删除 `DishNetDetail`、`DishMinorDetail`、`DishSeasoningDetail`、`DishSauceDetail`、`DishProcess`

## 保存 BOM

`PUT /api/dishes/[id]/bom`

1. 校验已发布状态，拒绝修改
2. 事务内先清空旧明细
3. 查询各食材最新单价，按 `unitPrice * amountG / 1000` 重新计算每条明细成本
4. 批量创建新明细
5. 重新汇总菜品总成本 `Dish.cost`

BOM 数据包含四层：

- `netDetails` — 主料/辅料
- `minorDetails` — 小料
- `seasoningDetails` — 调料
- `sauceDetails` — 酱料

## 保存工序

`PUT /api/dishes/[id]/processes`

1. 校验已发布状态，拒绝修改
2. 事务内删除旧工序，批量创建新工序
3. 工序字段：`stage`（初加工/预处理/上灶加工/出锅成品）、`stepNo`、`object`、`action`、`description`、`tool`、`standard`

## 状态生命周期

```
draft ──发布──> published
   ^              │
   └────下架──────┘
```

`pending` 状态在 schema 中存在，但当前业务流主要使用 `draft` 与 `published`。

## 校验 Schema

- `createDishSchema` / `updateDishSchema`：`lib/schemas/dish.ts`
- `dishBomSchema`：`lib/schemas/dish-bom.ts`
- `dishProcessSchema`：`lib/schemas/dish-process.ts`

## 注意事项

- 所有写操作均记录 `OperationLog`。
- 创建菜品时的事务隔离级别为 `Serializable`，用于避免高并发下编码重复。
- 前端 `app/components/dish-form/` 是这些 API 的主要调用方。
