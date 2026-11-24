# 全系统迭代升级基础 v1

> 制定日期：2026-11-15
> 来源：食材库（原料 / 净料 / 小料 / 调料 / 酱料）最近一轮迭代升级的通用化抽取
> 状态：当前唯一「工程与架构契约」文档

---

## 1. 定位与分工

| 维度 | 正本 | 管什么 |
|---|---|---|
| 视觉与交互 | [`docs/interaction-visual-baseline-v1.md`](./interaction-visual-baseline-v1.md) | 页面骨架、弹窗尺寸、字号、状态展示、颜色语义 |
| 工程与架构 | **本文档** | 口径字典、模块形态、能力复用、批次路线、验收门禁 |
| 数据模型 | [`memory-bank/Database.md`](../memory-bank/Database.md) | 表结构、字段含义、关系 |
| 推进记录 | [`memory-bank/progress.md`](../memory-bank/progress.md) | 每轮迭代的事实与结论 |

两份文档不重复同一结论：基线管「长什么样」，本文档管「怎么搭、改哪、验收什么」。

本文档每条契约都指向具体文件路径。**指不到具体实现的条款不写进来**——历史上文档与代码漂移造成了多次返工（见 [`docs/协作错误清单.md`](./协作错误清单.md) E6）。

---

## 2. 六条通用契约

### C1 · 枚举字典契约

**规则**

跨模块使用的枚举（口径、分类、状态、档位）必须落在 `lib/shared/`，不得定义在业务目录（`app/components/<domain>/`、`app/api/<domain>/`）里。

一个枚举字典必须同时提供五件套，缺一不可：

| 件 | 形态 | 样板（份量，2026-11-24 起为档案驱动） |
|---|---|---|
| 枚举值数组 | `as const` 字符串数组 | 份量档案行 `portion_profiles`（`lib/client/use-portion-profiles.ts` 拉取） |
| 选项元数据 | 数组，含 `value` / `label` / `description` + 业务元数据 | `toPortionOption`（倍率元数据 = 档案 `multiplier`） |
| 取值解析 | `getXOption(value)` → 选项或 `null` | `getPortionOption`（档案优先，`LEGACY_PORTION_OPTIONS` 兜底） |
| 合法性判断 | `isValidX(value)` → boolean | `validatePortionForCreate/Update`（`lib/server/portion-profile-utils.ts` 查表） |
| 渲染组件 | 通用层标签组件 | `app/components/ui/portion-tag.tsx` |

**附加约定**

- **落库存短值**：枚举落库用短值（如「社区·2份」），括号内容只作描述文案，不进数据库。
- **等价系数是唯一口径**：需要换算的枚举必须带一个业务系数；档案驱动后系数即档案 `multiplier`（份量 = 单人份 × 倍率），换算函数只认这个系数，不做字符串反推。
- **前后端共用同一份**：服务端 zod enum 与前端选项都从 `lib/shared/` 导入。`lib/server/schemas/` 不得另抄一份字面量。
- **历史值保留兼容解析**：枚举/档案重构后，旧值在解析函数里保留映射（`LEGACY_PORTION_OPTIONS` / `parsePortionCount`），不静默变成 `null`。

**强制载体**：`lib/shared/portion-scale.ts` 是份量样板（档案驱动反例参照：选项来自数据库而非硬编码数组）；`.agents/skills/ui-baseline` 与 `.agents/skills/domain-pricing` 写明约束。

**反例**

- 在 `app/components/dishes/` 里另写一份份量选项数组。
- 服务端 `z.enum(["单人份", ...])` 手写字面量，与份量档案各改各的。

---

### C2 · 列表页契约

**规则**

主数据列表页统一骨架，字段只有 `PageHeader → ListToolbar → DataTable → Pagination` 四段，不新造形态。

| 项 | 规则 |
|---|---|
| 字段标题 | 不携带单位；单位由数值行表达（列名 `净料单价`，值 `¥3.56/斤`） |
| 字段显示 | 表头加粗；字段单行完整显示，不用省略号截断，不用换行压缩列宽；列过多时优先删非核心列，允许表格局部横向滚动 |
| 进入详情 | 点击整行进入；操作列不重复放「查看」按钮 |
| 操作列 | 直接展示当前行可执行的全部业务动作图标，**不折叠进「更多」菜单** |
| 删除 | 统一收敛到详情页，列表操作列不提供删除入口 |
| 底部 | 统一展示数据区间汇总（「第 X-Y 条，共 N 条 X」）与每页条数选择 |
| 筛选 | 工具栏统一 `ListToolbar`（搜索 + 筛选项 + 重置）；搜索框前不放放大镜图标 |
| 分页归位 | 改搜索或筛选条件时页码归 1，由各页在 `onSearchChange` / `onReset` 中处理 |

**强制载体**：`app/components/ui/{page-header,list-toolbar,data-table,pagination}.tsx`；基线文档 §6.1 / §6.2.1。

**反例**

- 自建 `<Table>` 而不用 `DataTable`，导致加载态、空态、密度、横向滚动行为各不相同。
- 列名写「净料单价（元/斤）」，把单位塞进标题。

---

### C3 · 详情抽屉契约

**规则**

主数据详情用半屏抽屉（`RecordSheet`，`50vw`），不用独立详情页（字段超过 8 个或需要横向对照时才用独立页）。

| 项 | 规则 |
|---|---|
| 结构 | 抽屉头部（标题 + 编号/分类等 meta）→ 内容区 → 底部操作区（`RecordActions`） |
| 操作槽位 | `RecordActions` 三槽：`destructive`（删除，在左）/ `secondary`（复制、编辑）/ `primary`（主操作，在右）；危险操作与主操作分离 |
| 内容分组 | 用 `DetailSection` 分组，组内用 `InfoCell` 双列信息单元；不连续堆叠单行长列表 |
| 错误处理 | 加载失败要说明原因并给出下一步（关闭重试 / 检查是否已删除），不空转 |
| 未保存改动 | 只读 ↔ 编辑态切换时若表单 dirty，关闭必须先弹确认（`use-record-guard` + `DiscardChangesDialog`）；不允许静默丢弃 |
| 必填标识 | 表单字段使用 `FormField` 的唯一入口，必填、帮助、错误由组件承载 |

**强制载体**：`app/components/ui/{record-sheet,detail-section,use-record-guard,discard-changes-dialog}.tsx`；基线文档 §6.2.2。

**反例**

- 详情页删除按钮直接 `window.confirm`。
- 详情抽屉里错误信息只写「加载失败」，不给下一步。

---

### C4 · 档案复制契约

**规则**

复制是**新建动作**，不是编辑动作。

| 项 | 规则 |
|---|---|
| 入口 | 列表操作列与详情页都可触发 |
| 回填 | 以现有档案为模板回填全部业务字段，原档案不受影响 |
| 名称 | 默认追加「-副本」绕开重名校验，用户可自行修改 |
| 提交 | 按新建提交，不带原记录 id |
| 弹窗关系 | 从详情页触发时，复制表单以**新弹窗叠在详情抽屉之上**；提交成功后关闭全部弹窗 |
| 编排 | 用 `lib/client/use-record-copy.ts` 的 `useRecordCopy` 统一编排，不在页面里各写一遍 `buildCopyData` |

**强制载体**：`lib/client/use-record-copy.ts`；基线文档 §6.2.3。

**反例**

- 复制时带着原记录 id 提交，结果覆盖了原档案。
- 每个清单页自己写一份 `buildCopyData`，行为逐渐不一致。

---

### C5 · 连续录入契约

**规则**

批量录入场景下支持「保存并继续添加」。

| 项 | 规则 |
|---|---|
| 保留字段 | 分类、单位等「不随条目变化」的字段在保存后保留 |
| 清空字段 | 名称、品牌、价格、供应商等「每条都要填」的字段在保存后清空 |
| 弹窗 | 弹窗保持打开，焦点回到第一个需要重填的字段 |
| 反馈 | 明确提示「已保存，可继续添加下一条」，不静默留在原地 |
| 编排 | 用 `useRecordForm` 的 `keepOnContinue` / `clearOnContinue` 配置实现，不在业务 hook 里维护 ref 标志位 |

**强制载体**：`app/components/ui/use-record-form.ts`；基线文档 §6.2.4。

**反例**

- 保存成功后整个弹窗关闭，用户要一条条重新点开。
- 连续录入时分类被清空，用户每次都要重选。

---

### C6 · 存量口径迁移套路

**规则**

枚举或口径重构时，存量数据迁移必须：

1. **显式映射表**：迁移 SQL 里写出「旧值 → 新值」的逐条 UPDATE，不写模糊条件。
2. **盘点先行**：迁移前用只读查询确认存量真实取值集合，确认全部落在映射表覆盖范围内。
3. **保留兼容解析**：代码侧保留旧值解析映射，旧数据或半迁移数据不报错。
4. **零差异校验**：提交前 `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` 输出必须为空。
5. **部署三件套**：逐行读迁移 → 逐行读 `prisma/seed.ts` 的写操作 → 生产库只读盘点。

**样板**：`prisma/migrations/20261115100000_add_portion_to_net_ingredients/migration.sql`（`单人份→小碗菜`、`一锅10份→小碗菜·10份`）。

**强制载体**：`.agents/skills/prisma-migration-guard`、`.agents/skills/domain-pricing`。

**反例**

- 用 `UPDATE ... SET portion = '小碗菜' WHERE portion LIKE '%份%'` 这类模糊条件。
- 迁移后旧值直接解析为 `null`，静默改变业务含义。

---

## 3. 通用件清单

### 3.1 位置约定

```
app/components/ui/     通用业务封装层（33 个组件 + 1 个 hook）—— 跨业务域复用的放这里
app/components/<域>/   业务域组件 —— 只服务本域
lib/shared/            前后端共用纯函数 —— 口径字典、格式化、单位换算
lib/client/            仅客户端 hooks —— 分页、复制编排
lib/server/            服务端 —— 与数据库交互
```

**跨业务域引用的唯一合法路径**：`app/components/<域A>/` → `app/components/ui/` 或 `lib/shared/`。禁止 `app/components/<域A>/` 直接 import `app/components/<域B>/`。

> 原有一处违规：`app/components/dish-form/bom-picker-dialog.tsx` 跨目录引用 `app/components/ingredients/portion-tag.tsx`。已通过把 `PortionTag` 提升到 `app/components/ui/portion-tag.tsx` 修正。

### 3.2 唯一入口对照表

| 能力 | 唯一入口 | 备注 |
|---|---|---|
| 页面外层 | `PageShell` | `content` / `workspace` 两种 |
| 页面标题区 | `PageHeader` | 承载返回、状态、说明、主操作 |
| 弹窗尺寸 | `AppDialogContent` | `compact` / `form` / `wide` / `workbench` |
| 列表工具栏 | `ListToolbar` | 搜索 + 筛选 + 重置 |
| 列表表格 | `DataTable` | 加载态 / 空态 / 密度 / 横向滚动 |
| 分页 | `Pagination` | `totalLabel` / `showPageSize` 默认关闭 |
| 详情抽屉 | `RecordSheet` + `RecordActions` | 半屏 50vw |
| 详情信息分组 | `DetailSection` + `InfoCell` | 双列信息单元 |
| 简单记录三态 | `RecordDialog`（`RecordView` / `SimpleForm`） | 查看 / 新增 / 编辑；删除可放列表操作列（二次确认），编辑态不放 |
| 未保存拦截 | `useRecordGuard` + `DiscardChangesDialog` | 关闭前拦截 |
| 表单字段 | `FormField` / `FormSection` | 标签、必填、帮助、错误 |
| 表单状态 | `useRecordForm` | 初始化、dirty、错误、提交中、重置、连续录入 |
| 档案复制编排 | `useRecordCopy` | 复制状态与弹窗关系 |
| 状态语义 | `StatusBadge` / `statusToVariant` | 不手写颜色映射 |
| 菜品状态 | `DishStatusTag` | 菜品三态的唯一渲染入口，取值来自 `lib/shared/dish-status.ts` |
| 分类语义 | `CategoryTag` | 不复用状态色 |
| 空态 / 加载 | `EmptyState` / `LoadingState` / `SkeletonTable` | |
| 份量标签 | `PortionTag` | 份量枚举唯一渲染入口 |
| 份量标签 | `PortionTag` | 份量枚举唯一渲染入口 |
| 标准规格价格链路 | `lib/shared/seasoning-spec.ts` 的 `deriveStandardSeasoningPrices` | 与净料同构：单价 = 来源每斤单价 ÷ 出成率；成本价 = 单价 + 加工费；出库价 = 成本价 ÷ (1−毛利率/100)；标准规格价 = 出库价 × 标准规格 ÷ 500。**不另写一套价格公式**。⚠️ 2026-11-21 起调料支线暂时下线，仅保留待恢复 |
| 标准规格用量口径 | `lib/shared/bom-amount.ts` 的 `resolvePackageSpecAmountG` | BOM 用量唯一真源 = 档案 `packageSpec`；净料/小料共用。⚠️ 调料已回到「手填克数」口径，不再走本函数 |
| 标准化规格默认名 | `lib/shared/seasoning-spec.ts` 的 `buildStandardSeasoningDefaultName` | 「{调料名}•{克数}g」；用户改过就不覆盖 |

**新增或改版任一通用件，必须同步 `/ui-kit` 可视样张**（基线治理规则第 4 条）。

---

## 4. 通用模块骨架

一个主数据 CRUD 模块的标准构成，作为下一批改造的施工图。

```
app/<域>/page.tsx                       列表页
  └─ PageShell/PageHeader               标题 + 主操作
  └─ ListToolbar                        搜索 + 筛选 + 重置
  └─ DataTable                          列定义 + rowActions
  └─ Pagination                         totalLabel + showPageSize
  └─ <Domain>DetailSheet                详情抽屉（RecordSheet + RecordActions）
  └─ <Domain>FormDialog                 新建 / 编辑弹窗（FormDialog）
  └─ <Domain>RecordDialog               简单记录三态弹窗（RecordDialog：查看 / 新增 / 编辑）
  └─ <Domain>CopyDialog                 复制弹窗（useRecordCopy 编排，叠在抽屉上）
  └─ <Domain>DeleteDialog               删除确认（AppDialogContent size="compact"）

app/components/<域>/
  ├─ <domain>-detail-sheet.tsx          详情 + 内联编辑 + 未保存拦截
  ├─ <domain>-form-dialog.tsx           弹窗表单
  ├─ <domain>-form-fields.tsx           字段渲染（viewMode 只读 / 可编辑）
  ├─ use-<domain>-form.ts               业务校验 + 提交，状态委托 useRecordForm
  └─ <domain>-selector-dialog.ts        供其它模块选本域记录

app/api/<域>/
  ├─ route.ts                           GET 分页列表 / POST 新建
  └─ [id]/route.ts                      GET 详情 / PUT 更新 / DELETE 删除

lib/server/schemas/<域>.ts              zod：创建、更新、查询参数
```

**API 契约要求**（详见 `.agents/skills/api-endpoint`）

- 列表 GET 一律分页（`page` / `pageSize`），响应走 `paginated`。
- 请求体一律 `validateBody` 走 zod schema。
- 写操作一律 `logOperation`。
- 权限在 `lib/shared/access-control.ts` 的 `canAccessApi` 登记；**未登记的 API 默认仅管理员可访问**，新增 API 必须显式登记。
- 响应格式统一走 `lib/server/api-response.ts`。

---

## 5. 批次路线

采购模块当前被 `TRIAL_FEATURES.purchases = false` 锁定（页面与 `/api/purchase-*` 同时不可达），链路未在生产验证，因此**不排在首批**。

| 批次 | 模块 | 范围 | 依赖 | 验收 |
|---|---|---|---|---|
| **B0（本次）** | 基础 | 文档契约 + 通用件提升 + Skill 固化 | — | tsc / lint / jest / build 全绿；食材 5 清单与菜品 BOM 回归通过 |
| **B1（下一批）** | 设置 | `app/settings/` 7 页（units / stores / suppliers / users / classes / categories / net-packagings） | B0 | 12 条 lint 告警清零；7 页统一到 C2 + C3 + C4；`/ui-kit` 补样张 |
| B2 | 库存 | `app/components/inventory/` 3 Tab + 出库单详情 | B1（分页与弹窗尺寸模式已定型） | 台账与出库单双单位口径不回归 |
| **B3（进行中）** | 排程 + 生产计划 | `app/schedules/`、`app/production-plans/` | B1、B2 | 四条核心链路（排程 → 生产计划 → 完成生产 → 出库）端到端 |
| B4 | 菜品 | `app/dishes/`、`app/components/dish-form/` | B1 | 份量口径、BOM、转化倍率不回归 |
| B5 | 采购 | `app/purchases/` | 解锁 `TRIAL_FEATURES.purchases` | AI 识别与报销链路端到端 |

**批次原则**（沿用基线 §10）：不进行一次性全站重写；每批独立可交付、可验证、可回退。

B3 已因试运行反馈提前启动，B1（设置模块）已于 2026-11-15 完成（`436ec4d` 收口 7 页列表 + `086eb80` 三态弹窗，12 条 lint 告警清零），B2（库存双单位回归）仍欠账。提前启动不改变各批验收口径，B3 内部再按「契约与底座 → 列表 → 详情与表单 → 完成生产与打印 → 业务加固」拆成可独立回退的子批。

**食材库支线 · 调料标准化（2026-11-20 完成，2026-11-21 暂时下线）**：调料纳入与净料/小料同构的标准化体系——调料采购档案 →「转标准规格」→ `standard_seasonings` 档案（标准规格以 g 计、份量复用 `PORTION_VALUES`、价格链复用净料纯函数）→ 菜品 BOM 调料 Tab 只列已标准化规格、用量强制等于标准规格。存量 `dish_seasoning_details` 行（`spec_id` 为空）保持旧口径不迁移。本支线沉淀的可复用点已登记在 §3.2，供后续模块直接取用。

**调料口径回退（2026-11-21）**：上述标准化支线与实际业务不符，已暂时下线 —— 调料在菜品 BOM 里回到「直接选调料 + 手填克数」，成本 = 每斤单价 × 克需求 ÷ 500，采购毛需求 = 克需求 × 道数（出成率 100）。表、API、价格链纯函数与组件文件全部保留未删，UI 入口由 `app/components/ingredients/standard-seasoning-flag.ts` 的 `STANDARD_SEASONING_ENABLED` 统一控制（当前 `false`）；恢复时置 `true` 并回滚规格化分支即可。

---

## 6. 每批必跑的门禁

| 类别 | 手段 |
|---|---|
| 类型 | `npx tsc --noEmit` |
| 静态检查 | `npm run lint`（不得新增 `no-restricted-syntax` 告警） |
| 单测 | `npm test`（纯函数与通用件优先补测） |
| 构建 | `npm run build`（涉 schema / 依赖时必跑） |
| 迁移 | `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` 输出为空 |
| 样张 | `/ui-kit` 三档宽度（1280 / 1440 / 1920）目视检查 |
| 实机 | 改动页面在桌面宽度走一遍主路径 |
| 回归 | 排程、生产计划、库存、采购四条核心链路 |

详细执行口径见 `.agents/skills/verify-change`。

---

## 7. 维护规则

1. 契约变更时，**基线文档、本文档、对应 Skill 三者同一次提交内更新**（`.agents/skills/README.md` 维护规则第 3 条）。
2. 新增通用件必须同时：更新本文档 §3.2 唯一入口表、更新 `/ui-kit` 样张、在对应 Skill 里写明触发场景。
3. 契约只写本仓库真实存在的约定，通用最佳实践不进来。
4. 指向具体文件路径；指不到实现的条款不写。

---

*创建于 2026-11-15 | 配套 [`docs/interaction-visual-baseline-v1.md`](./interaction-visual-baseline-v1.md)（视觉交互契约）与 [`docs/ingredient-library-iteration-review-2026-11.md`](./ingredient-library-iteration-review-2026-11.md)（来源总结）*
