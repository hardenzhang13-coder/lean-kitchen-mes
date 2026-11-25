# 精益厨房 V3 — 功能与页面路由设计

> 基于 V3 产品定义和 Database.md，梳理所有页面路由、功能、交互。
> 本文件于 2026-11-14 按当前代码实现全量校正，与 `app/` 目录下的 `page.tsx` 一一对应。

---

## 一、路由树总览

```
/                                  工作台
│
├── /schedules                     菜品排程单（一级菜单「排程」）
│   ├── /schedules                 按状态三列看板；新建走弹窗（无独立新建页）
│   ├── /schedules/[id]            排程详情
│   ├── /schedules/[id]/edit       排程编辑
│   └── /schedules/[id]/print      排程打印
│
├── /production-plans              切配计划单（一级菜单「切配」）
│   ├── /production-plans          按状态三列看板；新建/编辑均为弹窗（URL 参数 ?create=1&date= / ?scheduleId= / ?editId= 驱动）
│   ├── /production-plans/[id]     计划单详情（含完成生产；待效「修改」就地开编辑弹窗）
│   ├── /production-plans/[id]/print     计划单打印
│   └── /production-plans/[id]/labels    切配标签打印
│
├── /self-production-orders        ~~内部生产单~~ 已下线（2026-11-22）：页面删除，模型与历史数据保留只读
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
│   ├── /ingredients/food           食材清单（食材/净料/小料三 Tab，标题「食材库」）
│   ├── /ingredients/seasoning     调味品（四 Tab：调味品/单品调料/复合调料/成品酱料）
│   └── /ingredients/sauce         酱料清单（2026-11-24 起入口隐藏，直达仍可用）
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
│  📅 排程  │   /schedules          菜品排程单
│  📋 切配  │   /production-plans   切配计划单（新建/编辑为弹窗两视图）
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

**功能：** 一周经营概览（`GET /api/dashboard/weekly`）。

**内容：**
- 顶部：问候 + 个人菜单（个人信息 / 退出登录）；侧边栏不再承载用户区
- 周切换：上一周 / 本周 / 下一周，`?week=<周一日期>` 写回 URL，刷新可回到同一周；窄屏横向滚动
- 表格式周历：左列为「菜品排程单」「生产计划单」两行，7 个日期列贯穿两行；每格列出该日单据，空态给出「新增排程 / 新增计划」，按权限直接打开对应创建弹窗并预填该日期
- 状态：加载中 / 空状态 / 正常

---

### 3.1 菜品排程单 `/schedules`

**功能：** 一级菜单「排程」。内容区按状态分成**三列看板**（待生效 / 进行中 / 已完成），单据以扁平卡片放在对应列里，卡片上直接推进流程，不必先进入详情。卡片上不再重复展示状态（由所在列表达）。

- 列头用状态色图标与文字 + 一句话说明（待生效=待确认可改可删 / 进行中=已确认等待切配入库 / 已完成=已入库仅可查看）区分三列，**列容器不带状态底色**；列头显示该状态总张数，单列超过 100 张时提示用搜索或日期缩小范围。
- **筛选（固定顺序）：** 搜索框 → 日期（单日）→ 门店。状态筛选已下线——状态由列直接表达。
- 卡片底部左侧显示制单人，右侧**只有主操作**；复制、编辑等次级动作不放卡片，收敛到详情页。

**卡片主操作（按状态唯一）：**

| 状态 | 主操作 |
|---|---|
| 待生效 | 确认生产 |
| 进行中 · 已纳入生产计划 | 查看生产计划 |
| 进行中 · 未纳入生产计划 | 等待排产（禁用，不可点击） |
| 已完成 | 查看详情 |

只读角色（业务运营）只看到「查看详情」，写操作按钮不渲染；写操作仍由 API 层限制为管理员 / 厨师长。

**点击卡片**直接打开预览弹窗（`AppDialogContent size="workbench"`，尺寸与创建净料/小料表单一致），内含排程菜单 / 切配工单 / 采购计划三个 Tab 与「查看完整详情」入口。

#### 新建菜品排程（弹窗，无独立页面）
点页面右上角「菜品排程」打开弹窗：

1. 第一行：**选择门店**（占 4 列）、**售卖日期**（即 `scheduleDate`，默认明天，日期控件带星期）。
2. 下方左右分区 **4:6**：左「已选菜品」（带标题栏与「N 道 · M 份」，一行一个菜），右「菜品库」（带标题栏、搜索与分类筛选）。
3. **标题没有输入项**：服务端按 `门店名称 · 周二（11月21日）·菜单` 生成（`lib/shared/schedule-title.ts`），创建与修改接口都忽略客户端传入的 `title`。
4. 点「完成」→ `POST /api/schedules`（服务端同一事务生成切配工单与采购计划行）→ 关闭弹窗并跳转该排程详情页。
5. `?create=1` 直接打开空弹窗；`?copyFrom=<排程ID>` 打开并回填门店与菜品（标题按新门店/日期生成）。

#### 排程详情 `/schedules/[id]`
- `PageHeader`：返回、状态、打印点菜单 / 复制；按状态给 修改 / 删除 / 确认生产 / 纳入生产计划单
- 摘要信息（`InfoTile`）：日期、门店、菜品与份数、制单信息
- 生产计划关联条；未回录售出份数提醒
- `SectionTabs` 分区：排程菜单 / 切配工单 / 采购计划 / 销售回录（待生效时不显示销售回录）
- 切配工单：净料名称、规格、需要量、单位、状态；**缺封装规格时顶部警示**，避免到完成生产才整单回滚
- 采购计划：原料名称、毛需求量、建议采购量、单位、金额、状态
- 销售数据回录：按实际售出份数回写，用于复盘

#### 排程打印 `/schedules/[id]/print`
菜单 + 切配工单 + 采购计划三段式打印视图：`?doc=menu`（门店点菜单）、`?doc=cutting`（切配工单）、`?doc=purchase`（采购计划，`&mode=supplier` 按供应商拆单）。


---

### 3.2 切配计划单 `/production-plans`

**功能：** 一级菜单「切配」。切配中心的汇总单据，把多店排程合并为一份切配 + 采购任务。

**列表** 与菜品排程单同构：按状态三列看板（待生效 / 进行中 / 已完成），列头带状态色与说明；**筛选固定为搜索框 → 日期（单日）**，无状态筛选与门店筛选（计划单本身跨店汇总，没有门店维度）。

**卡片主操作（按状态唯一）：**

| 状态 | 主操作 |
|---|---|
| 待生效 | 编辑（就地开弹窗）+ 确认生产 |
| 进行中 | **完成切配**：列表内直接打开确认弹窗 |
| 已完成 | 查看详情 |

卡片复用排菜模块拟物索引卡（`skeu-index-card`，`data-status` 三态换肤）：头部 label「切配中心」、名称位 = 编号（编号即简称，mono），日期盒 = 生产日期（与排菜模块同构：日 + 月·周几）；明细区 = 备注（无「查看更多」），无备注回退「汇总 N 张门店排程单」；卡高用 compact 变体收窄；底部统计「N 类 / M 份」（大类 = cuttingJson 行 l1Name 去重，份 = 计划切配份数合计）。点击卡片打开 workbench 预览弹窗。

**数据口径（`lib/server/production-plan-utils.ts`）：**
- 来源：门店排程（`scheduleIds`），**可以为空**（纯手工切配计划，schema 要求此时 adjustments 至少一行份数 > 0）
- 切配按 `(sourceType, sourceId)` 跨来源合并，净料用量相加；份数 = 合并量 ÷ 封装规格重算
- 行级调整（`adjustments: { sourceId, portions }[]`）：命中排程基线行则覆盖份数（基线保留在 `originalPortions`），delta 按 `份数差 × 封装规格 × 100 / 出成率` 折算原料毛需求并入采购；未命中则校验净料有效后追加 `origin: "manual"` 行并同口径并入采购
- 采购按 `(sourceType, sourceId)` 合并毛需求（克）；**不做库存抵扣**；`grossNeed` 不足时 clamp 到 0、行保留
- 生成时固化来源快照 v2（`lib/shared/production-plan.ts`：`stores[] + selfProduction[]`，兼容只读 v1；内部生产单下线后新单 `selfProduction: []`）
- 规格变更自动重算（incomplete-document-recalc / seasoning-spec-recalc）经 `planAdjustmentsFromCuttingJson()` 把 `cuttingJson` 行份数还原为 adjustments，保留用户调整

#### 新建/编辑切配计划（弹窗两视图，无步进条）

弹窗复用排菜模块骨架（`AppDialogContent size="workbench"` + skeu-panel 双栏 picking），内部 `view: "pick" | "confirm"` 切换。

1. **视图一「选择排程单」**：生产日期（DatePicker）+ **备注（必填，≤200 字）** + 选择进行中排程单。不按生产日期过滤；搜索支持门店名 / 单号 / 菜品名（`/api/schedules?q=` OR）；右栏候选卡片一行两列（门店 / 单号 / 份数 / 日期），左栏已选。底部主操作「**确认切配量**」，未选任何排程也可直接进入（纯手工切配计划）。
2. **视图二「确认切配量」**：表格列 = 分类 / 名称 / 封装规格 / **需求份数（只读高亮）** / **计划切配份数（skeu-input 可编辑，默认回显需求份数，手工行默认 0）** / 切配量 / **当前库存（份 + g，重点展示，仅参考不抵扣）** / 来源（排程/手工）/ 操作。库存 ≥ 需求份数的排程行给绿色系「可以移除」标识 + 移除按钮；移除语义 = 排程行提交 portions=0（行从视图消失、服务端行保留 0），手工行直接剔除。「**添加切配净菜**」走右侧抽屉（RecordSheet）：搜索 + 一级分类筛选 + 候选卡片 picking（`/api/net-ingredients`，缺封装规格不可纳入）。底部主操作「**确认切配计划**」→ POST `/api/production-plans`（编辑态 PUT）。客户端校验至少一行计划切配份数 > 0。
3. 无标题输入项：服务端按 `切配中心·周X（M月d日）切配计划` 生成标题；**编号即卡片简称**，规则 `PPL-年月日-时分`（创建时刻，如 `PPL-20261126-1230`，同分钟第 N 张追加 `-N` 后缀），编辑不变更。
4. `?scheduleId=<排程ID>` 预选单张（排程详情「纳入切配计划单」入口）；`?editId=<计划ID>` 编辑（待生效才可改，GET 详情回填 planDate/备注/排程/行份数）。
5. 预览端点 `GET /api/production-plans/preview?scheduleIds=1,2`（可空）：返回合并 cutting/purchase 行并附当前库存（行内 availablePortions/availableQtyG + 全量 stockMap/stockById），供视图二手工行库存展示。

#### 详情 `/production-plans/[id]`
- 摘要信息：编号、状态、来源排程、汇总份数、制单人（SkeuButton 操作区、PageTabs 页签、skeu 提示条，与排菜详情同构）
- Tab：切配汇总 / 采购汇总 / 来源排程
- **完成生产**（核心动作）：
  - 按份逐行确认，三态：完成 / 未完成 / 暂不确认（hold）
  - 「完成」行必须填实际完成份数，且该净料必须有封装规格，否则整单事务回滚
  - 提交后：净菜入库（份 + g 双单位）→ 写台账 → 回写各店切配工单 `actualQty` → 计划单终态
- 打印：计划单打印 + 切配标签打印（标签张数 = 用量 ÷ 封装规格）

#### 内部生产单 `/self-production-orders`（已下线，2026-11-22）

页面与写入口全部下线（列表/详情页、新建/编辑/激活/删除路由均删除）；模型 `SelfProductionOrder` / `SelfProductionItem` / `ProductionPlanSelfOrder` 与历史数据保留，API 仅留 GET 只读（生产计划单「内部生产」页签的历史快照展示依赖），出库新建入口同步移除。其「按日期指定净料/小料份数」能力并入生产计划单新建向导第二步的手工行（`origin: "manual"`）。

---

### 3.3 库存管理 `/inventory`

**功能：** v002 净菜库存，三个 Tab。

| Tab | 内容 |
|---|---|
| 当前库存 | 每个净料的当前份数与克数（双单位），按来源分组 |
| 出库单 | 出库单列表（11 列）：单号、日期、出库主体、来源单据、出库份数、合计金额、是否按计划、状态、库管、出库时间、操作 |
| 出入库流水 | 台账（双单位）：时间、品类、类型、份数、g、结存、来源单据、操作人 |

#### 创建出库单 `/inventory/outbound/new`
两视图工作台，顶部固定「出库时间 + 备注」：
1. 选择视图：左侧收货门店；右侧默认「切配单」（已完成且余量 >0 的 PPL），可切「排程单」（该店进行中且生产完成、未出库）。
2. 明细视图：全宽明细按份编辑实际出库份数 → 行金额实时计算 → 提交。切配单事务锁 PPL 与收货门店，扣批次余量 + 总库存；批次可拆多店多单。排程事务锁排程 + 收货门店，扣库存 + 写台账 + 排程完成。

> 切配中心（内部生产单）来源出库已下线：`createOutboundSchema` 拒绝 `selfOrderId` 并给明确文案；历史单据的渲染逻辑保留。

#### 出库单详情 `/inventory/outbound/[id]`
- 打印 + **作废**（作废 ≠ 删除，走事务回滚库存与台账；来源排程无其他有效出库单时恢复「进行中」）
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
  - 调料（`dish_seasoning_details`）：直接选**采购调料**（`ingredients`，SEA 体系）+ **手填克数**，成本 = 每斤单价 × 克数 ÷ 500（无份量）
  - 酱料（`dish_sauce_details`）：酱料、用量(g)
- 加工流程：4 阶段（初加工 → 预处理 → 上灶加工 → 出锅成品），每阶段有序步骤
- 状态生命周期：`draft` → `pending` → `published`
- 保存分三步提交：`POST /api/dishes` → `PUT /api/dishes/[id]/bom` → `PUT /api/dishes/[id]/processes`

---

### 3.5 食材库 `/ingredients`

#### 总览 `/ingredients`
流向看板：食材、调味品、香料三类节点统一流向菜品库（2026-11-24 改版；香料为占位节点，净料/小料撤下首页、清单页保留）；统一计价规则面板。**「酱料」节点维持隐藏**（只隐入口，模型/API/菜品 BOM 保留）。

#### 清单页
`/ingredients/food`（食材清单三 Tab：食材清单/净料/小料）| `/ingredients/seasoning`（调味品四 Tab）| `/ingredients/sauce`（酱料清单，入口已隐藏，直达仍可用）

| 清单 | 突出字段 | 操作顺序 |
|---|---|---|
| 食材 | 名称、每斤单价 | 编辑（默认动作按钮）→ 转化（转净料/小料，主操作最右）；入库单位隐藏 |
| 净料 | 名称、标准规格价 | 编辑 → 删除 |
| 小料 | 名称、标准规格价 | 编辑 → 删除 |
| 调味品 | 名称、每斤单价 | 查看 → 编辑 → 转化（转调料清单，主操作最右） |
| 酱料 | 名称、标准规格价 | 编辑 → 删除 |

通用交互（按交互视觉基线 v1）：
- 表头统一加粗，字段单行完整显示，不使用省略号截断
- 表头不携带单位，单位由数值行表达（如 `¥3.56/斤`）
- 详情通过**点击整行**进入半屏抽屉（50vw），按「基础信息 / 采购与计量 / 包装与规格 / 价格与成本」分组
- 操作列直接展示当前行可执行的全部业务动作图标，不折叠进「更多」菜单

#### 调味品 `/ingredients/seasoning`（2026-11-24 升级）
- 四 Tab：**调味品 / 单品调料 / 复合调料 / 成品酱料**；后三个按 `seasoning_type` 类型字段过滤（不占食材分类体系，迁移 `20261124170000`；类型字段在表单中位于商品名称下方）
- 「转化」= 转调料清单：创建 `standard_seasonings` 档案（完整复刻食材→净料链路：来源调味品 + 包装规格 + 出成率 + 价格派生 + 份量档案校验）；编辑/删除走「查看调料清单」抽屉（`StandardSeasoningListSheet`）
- 调味品详情抽屉底部功能区：左侧「删除」，中间「复制 / 编辑」（与基线 §6.2.4 一致）
- 行操作：编辑、删除（被菜品引用时拒绝删除）
- 调味品**直接**进入菜品 BOM（本期不动 BOM 口径，仍选调味品+手填克数）
- 开关 `STANDARD_SEASONING_ENABLED` 已置 `true`（2026-11-24 复活调料清单链路）

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

---

### 3.9 新增 API（2026-11 调料标准化）

> **2026-11-21 起暂时下线**：以下接口保留可用但无 UI 入口（`STANDARD_SEASONING_ENABLED = false`），菜品 BOM 不再引用标准规格。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/standard-seasonings` | 标准化调料列表（分页；`q` 只搜名称；支持 `sourceIngredientId` / `l1Code` / `l2Code` 过滤；每行附派生价格与关联菜品数） |
| POST | `/api/standard-seasonings` | 新建标准化规格（来源调料须属 SEA 体系；编号 `SEA-SP-xxxx`；二级分类继承来源调料） |
| GET | `/api/standard-seasonings/[id]` | 标准化规格详情（含派生价格与关联菜品数） |
| PUT | `/api/standard-seasonings/[id]` | 更新；标准规格/出成率/来源/加工费/毛利率变化时联动 BOM 行、重算菜品成本并重建未完成的排程与生产计划（有执行进度返回 409） |
| DELETE | `/api/standard-seasonings/[id]` | 软删除；被菜品 BOM 引用时拒绝 |

**权限**：已登记到 `lib/shared/access-control.ts` 的主数据前缀，读 admin/operations，写 admin/operations（与 `/api/net-ingredients` 同级）。

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
