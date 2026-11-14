# 精益厨房 V3 — 功能与页面路由设计

> 基于 V3 产品定义和 Database.md，梳理所有页面路由、功能、交互。
> 本文件于 2026-11-14 按当前代码实现全量校正，与 `app/` 目录下的 `page.tsx` 一一对应。

---

## 一、路由树总览

```
/                                  工作台
│
├── /schedules                     排程（门店排程单 + 生产计划单 双 Tab）
│   ├── /schedules                 列表（双模块切换）
│   ├── /schedules/new             新建排程
│   ├── /schedules/[id]            排程详情
│   ├── /schedules/[id]/edit       排程编辑
│   └── /schedules/[id]/print      排程打印
│
├── /production-plans              生产计划单（切配中心）
│   ├── /production-plans/new      新增生产计划单
│   ├── /production-plans/[id]     计划单详情（含完成生产）
│   ├── /production-plans/[id]/edit      计划单编辑
│   ├── /production-plans/[id]/print     计划单打印
│   └── /production-plans/[id]/labels    切配标签打印
│
├── /inventory                     库存管理（v002 净菜库存，三 Tab）
│   ├── /inventory                 当前库存 / 出库单 / 出入库流水
│   ├── /inventory/outbound/new    创建出库单（两步向导）
│   ├── /inventory/outbound/[id]   出库单详情（打印 / 作废回滚）
│   └── /inventory/outbound/[id]/print   出库单打印
│
├── /dishes                        菜品库
│   ├── /dishes                    菜品列表
│   ├── /dishes/new                新建菜品
│   ├── /dishes/[id]               菜品详情
│   └── /dishes/[id]/edit          菜品编辑
│
├── /ingredients                   食材库
│   ├── /ingredients               食材库总览（转化流程图）
│   ├── /ingredients/raw           原料清单
│   ├── /ingredients/raw/[id]      原料详情
│   ├── /ingredients/net           净料清单
│   ├── /ingredients/net/[id]/labels    净料标签打印
│   ├── /ingredients/minor         小料清单
│   ├── /ingredients/seasoning     调料清单
│   └── /ingredients/sauce         酱料清单
│
├── /purchases                     采购管理（试运行期间锁定）
│   ├── /purchases                 采购单列表
│   ├── /purchases/new             采购单录入
│   ├── /purchases/reimbursements  报销单列表
│   ├── /purchases/reimbursements/new     新建报销单
│   └── /purchases/reimbursements/[id]    报销单详情
│
├── /settings                      系统设置
│   ├── /settings                  设置总览（固定四列）
│   ├── /settings/classes          食材分类（一级 + 二级）
│   ├── /settings/categories       菜品类别
│   ├── /settings/net-packagings   净菜包装
│   ├── /settings/units            单位
│   ├── /settings/stores           门店管理
│   ├── /settings/suppliers        供应商
│   ├── /settings/users            用户管理（仅管理员）
│   └── /settings/profile          个人资料
│
├── /ui-kit                        交互视觉基线可视验收页
├── /forbidden                     无权限页
└── /login                         登录页
```

共计 **7 个业务模块 + 工作台，40 个页面**。

---

## 二、侧边栏导航

紧凑图标式侧边栏，`fixed left-0 top-0 h-full w-20`（80px），内容区留出 `ml-20`。

```
┌──────────┐
│   🍳     │  ← 品牌区（Logo + 「精益厨房」）
├──────────┤
│  ⊞ 工作台 │   /
│  📋 排程  │   /schedules
│  🛒 采购  │   /purchases      （试运行锁定，角标提示）
│  📦 库存  │   /inventory
│  🍽️ 菜品  │   /dishes
│  🥬 食材  │   /ingredients
│  📖 设置  │   /settings
├──────────┤
│   👤 退出 │   个人资料 / 退出登录
└──────────┘
```

样式规则：
- nav-btn: `flex flex-col items-center justify-center w-16 h-16 rounded-md gap-1`
- active: `bg-primary/10 text-primary` + 左侧 `before:` 竖条指示器
- default: `text-muted-foreground hover:text-foreground hover:bg-muted`
- 导航项按当前用户角色过滤（`canAccessPage`），无权限项不渲染

---

## 三、页面详细设计

### 3.0 工作台 `/`

**功能：** 当日排程与门店营业概览。

**内容：**
- 顶部：日期选择 + 门店选择
- 当日排程卡片：菜品、份数、门店；有排程时列出，无排程时给出「去创建排程」动作
- 状态：加载中 / 空状态（当日无排程）/ 正常

---

### 3.1 排程 `/schedules`

**功能：** 排程模块的入口页，用顶部模块切换承载两类单据。

**模块切换（两个 Tab 式按钮）：**
- **门店排程单**：按日期 + 门店排的菜品与份数
- **生产计划单**：切配中心汇总单（跨店合并）

**状态筛选：** 全部状态 / 待生效 / 进行中 / 已完成

#### 新建排程 `/schedules/new`
1. 选择日期（默认明天）与门店
2. 从菜品库选择菜品（搜索 + 勾选）
3. 每道菜填写份数
4. 提交 → 服务端 `buildCuttingOrders()` + `buildPurchasePlans()` 在同一事务内生成切配工单与采购计划行 → 跳转到排程详情

#### 排程详情 `/schedules/[id]`
- 摘要信息（`InfoTile`）：日期、门店、菜品数、总份数、制单人
- `SectionTabs` 分区：菜单明细 / 切配工单 / 采购计划 / 销售回录
- 切配工单：净料名称、规格、需要量、单位、状态
- 采购计划：原料名称、毛需求量、建议采购量、单位、金额、状态
- 销售数据回录：按实际售出份数回写，用于复盘

#### 排程打印 `/schedules/[id]/print`
菜单 + 切配工单 + 采购计划三段式打印视图。

---

### 3.2 生产计划单 `/production-plans`

**功能：** 切配中心的汇总单据，把多店排程合并为一份切配 + 采购任务。

**数据口径（`lib/server/production-plan-utils.ts`）：**
- 切配按 `(sourceType, sourceId)` 跨店合并，净料用量相加；份数 = 合并量 ÷ 封装规格重算
- 采购按 `(sourceType, sourceId)` 合并毛需求（克）；**不做库存抵扣**（库存模块改版中）
- 生成时固化来源排程快照（`lib/shared/production-plan.ts`）

#### 新增 `/production-plans/new`
选择来源排程（可多选）→ 生成计划单 → 自动汇总切配与采购。

#### 详情 `/production-plans/[id]`
- 摘要信息：编号、状态、来源排程、汇总份数、制单人
- Tab：切配汇总 / 采购汇总 / 来源排程
- **完成生产**（核心动作）：
  - 按份逐行确认，三态：完成 / 未完成 / 暂不确认（hold）
  - 「完成」行必须填实际完成份数，且该净料必须有封装规格，否则整单事务回滚
  - 提交后：净菜入库（份 + g 双单位）→ 写台账 → 回写各店切配工单 `actualQty` → 计划单终态
- 打印：计划单打印 + 切配标签打印（标签张数 = 用量 ÷ 封装规格）

---

### 3.3 库存管理 `/inventory`

**功能：** v002 净菜库存，三个 Tab。

| Tab | 内容 |
|---|---|
| 当前库存 | 每个净料的当前份数与克数（双单位），按来源分组 |
| 出库单 | 出库单列表（11 列）：单号、日期、门店、来源排程、出库份数、合计金额、是否按计划、状态、库管、创建时间、操作 |
| 出入库流水 | 台账（双单位）：时间、品类、类型、份数、g、结存、来源单据、操作人 |

#### 创建出库单 `/inventory/outbound/new`
两步向导：
1. 选择来源排程 → 展示计划行（需求份数、当前库存、出库价快照）
2. 按份编辑实际出库份数 → 行金额实时计算 → 提交（事务：扣库存 + 写台账 + 标记是否按计划）

#### 出库单详情 `/inventory/outbound/[id]`
- 打印 + **作废**（作废 ≠ 删除，走事务回滚库存与台账）
- 合计金额 = 出库价（元/斤快照）× 出库 g ÷ 500

---

### 3.4 菜品库 `/dishes`

#### 列表 `/dishes`
- 搜索 + 状态筛选
- 列表含成本列（**按当前食材价格实时重算**，不是历史快照）
- 点击行进入详情

#### 详情 / 编辑 `/dishes/[id]`、`/dishes/[id]/edit`
- 基础信息：名称、编号、类别、菜系、工艺、口味、份量、季节、荤素类型
- 配方构成 4 类：
  - 主料/辅料（`dish_net_details`）：净料、用量(g)
  - 小料（`dish_minor_details`）：小料、用量(g)
  - 调料（`dish_seasoning_details`）：调料、用量(g)
  - 酱料（`dish_sauce_details`）：酱料、用量(g)
- 加工流程：4 阶段（初加工 → 预处理 → 上灶加工 → 出锅成品），每阶段有序步骤
- 状态生命周期：`draft` → `pending` → `published`
- 保存分三步提交：`POST /api/dishes` → `PUT /api/dishes/[id]/bom` → `PUT /api/dishes/[id]/processes`

---

### 3.5 食材库 `/ingredients`

#### 总览 `/ingredients`
食材转化流程图：原料与调料经初加工、配比组合转化为净料、小料与酱料；统一计价规则面板。

#### 5 类清单页
`/ingredients/raw` | `/ingredients/net` | `/ingredients/minor` | `/ingredients/seasoning` | `/ingredients/sauce`

| 清单 | 突出字段 | 操作顺序 |
|---|---|---|
| 原料 | 名称、每斤单价 | 编辑 → 转净料 → 删除 |
| 净料 | 名称、标准规格价 | 编辑 → 删除 |
| 小料 | 名称、标准规格价 | 编辑 → 删除 |
| 调料 | 名称、每斤单价 | 编辑 → 删除 |
| 酱料 | 名称、标准规格价 | 编辑 → 删除 |

通用交互（按交互视觉基线 v1）：
- 表头统一加粗，字段单行完整显示，不使用省略号截断
- 表头不携带单位，单位由数值行表达（如 `¥3.56/斤`）
- 详情通过**点击整行**进入半屏抽屉（50vw），按「基础信息 / 采购与计量 / 包装与规格 / 价格与成本」分组
- 操作列直接展示当前行可执行的全部业务动作图标，不折叠进「更多」菜单

#### 原料详情 `/ingredients/raw/[id]`
#### 净料标签 `/ingredients/net/[id]/labels`
净料/小料的包装标签打印，标签张数按 `用量 ÷ 封装规格` 计算。

---

### 3.6 采购管理 `/purchases`（试运行锁定）

> 当前由 `lib/shared/features.ts` 的 `TRIAL_FEATURES.purchases = false` 统一锁定：导航保留入口并加角标，页面重定向到 `/purchases`，`/api/purchase-*` 与 `/api/upload` 在 `proxy.ts` 返回 403。开放时只需把该开关改为 `true`。

- **采购单列表** `/purchases`：采购日期、供应商、总金额、状态、操作
- **采购单录入** `/purchases/new`：拍照上传 → 通义千问识别物料品名/数量/单价 → 填入表单 → 人工确认 → 提交入库；也支持手工逐条录入
- **报销单** `/purchases/reimbursements`：多张采购单归并结算

---

### 3.7 系统设置 `/settings`

**设置总览 `/settings`**：固定四列展示（仅适配 Web 桌面端），入口为食材分类、菜品类别、净菜包装、单位、门店管理、供应商、用户管理。

**列表页（结构相同，CRUD）**：
`/settings/classes` | `/settings/categories` | `/settings/net-packagings` | `/settings/units` | `/settings/stores` | `/settings/suppliers` | `/settings/users`

| 页面 | 说明 |
|---|---|
| 食材分类 | 同时展示一级与二级，二级挂在一级下，新增二级需选择所属一级 |
| 菜品类别 | 菜品分类字典 |
| 净菜包装 | 包装名称 + 包装尺寸；同名可配多个尺寸；被净料引用时禁止改名/改尺寸，只能停用 |
| 单位 | 单位字典与换算系数（重量类单位维护 `gramsPerUnit`） |
| 门店管理 | 门店档案与营业价 |
| 供应商 | 供应商字典 |
| 用户管理 | 仅管理员可见，用户 CRUD 与角色分配 |

**个人资料 `/settings/profile`**：所有角色可见。

---

### 3.8 辅助页面

- **`/ui-kit`**：交互视觉基线的可视验收页，组件改动必须同步样张
- **`/forbidden`**：无权限访问时由 `proxy.ts` 重写到此页
- **`/login`**：登录页，已登录访问会重定向回工作台

---

## 四、页面状态约定

| 状态 | 说明 | 组件 |
|---|---|---|
| 加载中 | 结构稳定的骨架屏 | `LoadingState`（table / list / card-grid / page / inline） |
| 空数据 | 说明原因 + 给出下一步动作 | `EmptyState` |
| 错误 | 错误原因 + 重试或修改路径 | Toast + 内联提示 |
| 正常 | 正常展示数据 | — |

---

## 五、交互原则

1. **交互视觉以 `docs/interaction-visual-baseline-v1.md` 为唯一基线**，页面骨架优先用 `PageShell` / `PageHeader`，状态、空态、加载态和弹窗优先用 `app/components/ui/` 下的业务封装。
2. **弹窗只走 `AppDialogContent` 语义尺寸**（compact / form / wide / workbench），业务页面不写像素宽度。
3. **简单 CRUD 用弹窗**（`FormDialog`），超过 8 个字段、多步骤或需横向对照时用独立页面（`PageShell variant="workspace"`）。
4. **表单提交中禁用重复提交**；失败保留用户输入；成功后明确跳转或关闭。
5. **删除操作二次确认**，破坏性操作说明影响范围与是否可恢复，默认焦点不落在危险按钮。
6. **列表页统一搜索 / 筛选 / 重置**（`ListToolbar`）+ 分页（`Pagination`，只保留上一页 / 当前页 / 下一页）。
7. **操作日志**：所有增删改通过 `logOperation` 写入 `operation_logs`。

---

*版本：v2.0 | 2026-11-14 | 按当前实现全量校正：新增生产计划单、v002 净菜库存、设置模块、净菜包装字典；采购模块标注为试运行锁定*
