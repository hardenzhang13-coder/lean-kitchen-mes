# 小料与酱料模块优化 — 功能开发 Spec

> 本文档作为 Claude Code 的完整执行需求输入，涵盖 2 项核心改造。请按本文档描述的业务逻辑、交互规范、数据变更要求执行实现，代码层面的设计与执行由 CC 的 plan 模式自主完成。
>
> 当前系统版本：Next.js 16 + React 19 + Prisma 7 + PostgreSQL

---

## 一、需求总览

| 编号 | 需求 | 类型 | 优先级 |
|------|------|------|--------|
| 1 | 小料数据源切换：废弃独立 `minor_ingredients` 表，数据统一走 `net_ingredients`，通过食材分类体系区分 | 重构 | P0 |
| 2 | 酱料字段改造：新增 `brand`/`spec`/`type`，移除 `storage`，`unit` 默认固定为 `g` | 优化 | P0 |

---

## 二、详细需求说明

### 需求 1：小料数据源切换

#### 现状问题
- `minor_ingredients` 独立表，数据 0 条，字段与净料表高度重叠
- 单独维护成本高，菜品 BOM 无法引用
- 前端 `/ingredients/minor` 使用独立 API 和表单，与净料体系割裂

#### 目标业务逻辑
1. 废弃 `minor_ingredients` 表和 `/api/minor-ingredients` API
2. 小料数据统一存储在 `net_ingredients` 表，通过一级分类「小料」(MIN) 区分
3. 前端 `/ingredients/minor` 页面保持独立 CRUD 体验，但底层调用 `/api/net-ingredients` 带分类筛选
4. 小料页面的表单自动锁定分类：二级分类只展示「小料」下的选项
5. 净料页面 `/ingredients/net` 过滤小料分类数据，避免重复展示
6. `net_ingredients` 的 `source_ingredient_id` 和 `yield_rate` 改为 `Optional`（非必填），因为小料无原料来源和出成率概念

#### 涉及范围
- `prisma/schema.prisma` — 删除 `MinorIngredient` 模型，修改 `NetIngredient` 字段
- `prisma/seed.ts` — 新增小料一级分类和二级分类
- `app/api/minor-ingredients/*` — 删除或改为代理路由
- `app/api/net-ingredients/route.ts` — 新增分类筛选参数
- `app/ingredients/minor/page.tsx` — 表单改造（使用净料表结构，分类自动锁定）
- `app/ingredients/net/page.tsx` — 过滤小料分类数据
- `app/ingredients/page.tsx` — 小料卡片数据从净料表筛选

#### 注意事项
- **种子数据补充**：当前 `seed.ts` 中**没有小料一级分类**，需要新增 `MIN` 一级分类和至少 2 个二级分类（如 `MIN-GAR` 姜蒜类、`MIN-HER` 香料类）
- 前端表单中的「原料来源」和「出成率」字段：小料场景下不展示（或展示但非必填），净料场景下仍为必填
- 小料列表页展示字段：编号、名称、规格、单价、单位、二级分类
- 编号前缀：小料仍使用 `PRD-XXXX`（净料编号体系），不再使用 `SML-XXXX`
- `dish_minor_details` 外键改为指向 `net_ingredients.id`（当前无数据，直接改 Schema 即可）

### 需求 2：酱料字段改造

#### 现状问题
- `sauce_ingredients` 缺少「类型」「规格」字段，无法区分自制/外购
- `storage` 字段对于酱料意义不大，运营未使用
- 前端表单字段组织松散

#### 目标业务逻辑
1. 新增 `brand`（商品/品牌名称）、`spec`（规格）、`type`（自制/外购）字段
2. 移除 `storage` 字段
3. `unit` 默认固定为 `'g'`，前端表单只读展示，不开放选择
4. 前端表单按新字段重组：名称、商品/品牌名称、规格、单价、单位（只读g）、配方（多行文本）、类型（TileGroup 平铺）

#### 涉及范围
- `prisma/schema.prisma` — `SauceIngredient` 模型字段变更
- `app/api/sauce-ingredients/route.ts` — 请求/响应字段变更
- `app/api/sauce-ingredients/[id]/route.ts` — 同上
- `app/ingredients/sauce/page.tsx` — 表单和列表字段改造

#### 注意事项
- `brand` 字段当前已存在，但前端标签需改为「商品/品牌名称」
- `type` 字段使用 TileGroup 平铺「自制」/「外购」两个选项
- 配方 `recipe` 保持 `text` 类型，前端使用多行文本输入框
- 现有 `storage` 数据为空（表空），无需数据迁移

---

## 三、数据模型变更

### 1. 废弃表

| 表名 | 动作 | 原因 |
|------|------|------|
| `minor_ingredients` | 删除 | 数据为 0，字段与净料重叠，统一走 `net_ingredients` |

### 2. `net_ingredients` 调整

| 字段 | 当前类型 | 变更后 | 说明 |
|------|----------|--------|------|
| `source_ingredient_id` | `Int`（必填） | `Int?`（Optional） | 小料无原料来源，允许为空 |
| `yield_rate` | `Decimal`（必填） | `Decimal?`（Optional） | 小料无出成率概念，允许为空 |

### 3. `sauce_ingredients` 调整

| 字段 | 当前类型 | 变更后 | 说明 |
|------|----------|--------|------|
| `brand` | `String`（已有） | `String` | 前端标签改为「商品/品牌名称」 |
| `spec` | 无 | `String?` ➕ 新增 | 规格，如"500g/瓶" |
| `type` | 无 | `String` ➕ 新增 | 枚举：自制 / 外购 |
| `storage` | `String` | ➖ 移除 | 不再维护 |
| `unit` | `String` | `String`（默认 'g'） | 前端只读展示，不开放选择 |

### 4. 种子数据补充

在 `prisma/seed.ts` 中新增：

```typescript
// 一级分类新增
{ code: "MIN", name: "小料" }

// 二级分类新增（示例）
{ code: "MIN-GAR", name: "姜蒜类", parentCode: "MIN", description: "" }
{ code: "MIN-HER", name: "香料类", parentCode: "MIN", description: "" }
```

---

## 四、API 接口变更

### 1. `GET /api/net-ingredients`

**新增查询参数**：`?l1Code=MIN`（或 `?category=小料`，按一级分类 code 筛选）

**逻辑变更**：当传入 `l1Code` 参数时，通过 `l2_code` 关联 `ingredient_categories_l2` 表，筛选 `parent_code = l1Code` 的记录。

### 2. `POST /api/net-ingredients`

**逻辑变更**：如来自小料页面（可通过请求体中的 `isMinor` 标志或根据 `l2_code` 判断），校验 `l2_code` 的 `parent_code` 是否属于「小料」分类，否则拒绝。

**字段变更**：`source_ingredient_id` 和 `yield_rate` 允许为空。

### 3. `DELETE /api/minor-ingredients`

**废弃**：删除该路由。前端小料页面改为调用 `DELETE /api/net-ingredients/[id]`。

### 4. `GET /api/sauce-ingredients`

**响应结构变更**：移除 `storage`，增加 `brand`/`spec`/`type`。

### 5. `POST /api/sauce-ingredients`

**请求字段变更**：
- 新增：`spec`（可选）、`type`（必填，值："自制" | "外购"）
- 移除：`storage`
- `unit` 默认 `'g'`，后端兜底，不接受前端传入

### 6. `PUT /api/sauce-ingredients/[id]`

同上。

---

## 五、交互设计与页面规范

### 页面：小料清单 `/ingredients/minor`

**列表字段顺序**：
1. 编号
2. 名称
3. 规格
4. 单价
5. 单位
6. 二级分类

**新增/编辑弹窗表单字段**：
- 名称（Input，必填）
- 规格（Input，可选）
- 单价（Input Number，必填）
- 单位（Input，默认 "g"，可修改）
- 二级分类（TileSelect 弹窗，**只展示小料分类下的选项**，必填）
- ~~原料来源（隐藏）~~
- ~~出成率（隐藏）~~

**按钮行为**：保存后调用 `POST /api/net-ingredients`，成功后刷新列表。

### 页面：净料清单 `/ingredients/net`

**列表过滤**：查询 `net_ingredients` 时排除 `l2_code` 属于小料分类的数据。

实现方式：后端查询时加 `NOT l2_code IN (SELECT code FROM ingredient_categories_l2 WHERE parent_code = 'MIN')`。

### 页面：酱料清单 `/ingredients/sauce`

**列表字段顺序**：
1. 编号
2. 名称
3. 商品/品牌名称
4. 规格
5. 单价
6. 单位（固定显示 `g` badge）
7. 类型（badge：自制/外购）

**新增/编辑弹窗表单字段**：
- 名称（Input，必填）
- 商品/品牌名称（Input，必填）
- 规格（Input，必填）
- 单价（Input Number，必填）
- 单位（只读展示 "g"，不开放输入）
- 配方（Textarea 多行，必填）
- 类型（TileGroup 平铺：自制 / 外购，必填）

---

## 六、技术约束与红线

- 禁止新增 `any` 类型
- 禁止无分页的列表 API
- 输入校验（Zod schema 或手动校验）
- 事务内操作（`prisma.$transaction`）涉及库存时
- 操作日志（`logOperation`）
- Schema 迁移：**`prisma migrate dev`**，**禁止 `db push`**
- 代码提交前检查顺序：`npx tsc --noEmit` → `npm run build` → `npm run lint`
- 废弃的 `minor_ingredients` 表：先确认无数据后直接删除模型，Prisma migrate 会自动处理

---

## 七、验收标准

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 1 | 小料列表可正常展示 | `/ingredients/minor` 显示净料表中一级分类为「小料」的数据 | 浏览器访问 |
| 2 | 新增小料成功 | 填写名称/规格/单价/单位/二级分类，保存后落入 `net_ingredients` | 数据库查询 + 前端刷新 |
| 3 | 小料分类自动锁定 | 小料页面二级分类选择器只展示小料分类下的选项 | 前端验证 |
| 4 | 净料页面过滤小料 | `/ingredients/net` 不展示小料分类数据 | 浏览器验证 |
| 5 | 酱料列表展示新字段 | `/ingredients/sauce` 展示编号/名称/商品品牌/规格/单价/类型 | 浏览器验证 |
| 6 | 酱料新增/编辑完整 | 填写所有必填字段，保存成功，单位固定为 g | 浏览器验证 + 数据库查询 |
| 7 | 种子数据包含小料分类 | 重新 seed 后，`ingredient_categories_l1` 包含「小料」，`l2` 包含姜蒜类/香料类 | 数据库查询 |
| 8 | 构建通过 | `npx tsc --noEmit` + `npm run build` + `npm run lint` 全部通过 | 命令行 |

---

## 八、相关文件参考

| 文件 | 当前功能 |
|------|----------|
| `prisma/schema.prisma` | 数据模型定义（`MinorIngredient`/`SauceIngredient`/`NetIngredient`） |
| `prisma/seed.ts` | 种子数据（一级分类在 ~line 37-45，二级分类在 ~line 51+） |
| `app/api/minor-ingredients/route.ts` | 小料 API（GET/POST）— 需废弃 |
| `app/api/sauce-ingredients/route.ts` | 酱料 API（GET/POST）— 需改造字段 |
| `app/api/sauce-ingredients/[id]/route.ts` | 酱料单条 API（GET/PUT/DELETE）— 需改造字段 |
| `app/api/net-ingredients/route.ts` | 净料 API（GET/POST）— 需新增分类筛选 |
| `app/ingredients/minor/page.tsx` | 小料前端页面 — 需改为调用净料 API |
| `app/ingredients/sauce/page.tsx` | 酱料前端页面 — 需改造表单字段 |
| `app/ingredients/net/page.tsx` | 净料前端页面 — 需过滤小料 |
| `app/ingredients/page.tsx` | 食材库总览 — 小料卡片数据需调整 |

---

## 边界（不涉及）

- 不修改 `dish_minor_details` 的关联（当前无数据，Schema 外键切换已在范围内）
- 不修改菜品模块的任何页面（菜品 BOM 引用小料/酱料属于 MVP2，挂起）
- 不修改调料（`seasoning-ingredients`）模块
- 不修改原料（`ingredients`）模块
- 不增加小料批量导入功能（挂起）
- 不修改工作台、排程、采购、库存等其他模块
