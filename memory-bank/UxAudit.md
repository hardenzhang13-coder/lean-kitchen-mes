# 三模块交互盘查与优化方案（工作台 / 排程 / 菜品）

> 版本 v1.0 | 2026-11-07 | 基于 `memory-bank/Design.md` v2.0 规范 + ui-ux-pro-max 规则优先级盘查
> 规则优先级参照：可访问性 > 触控与交互反馈 > 性能(CLS/请求) > 风格一致性 > 布局 > 动效 > 表单反馈 > 导航

---

## 〇、系统性问题（跨模块，优先治理）

| # | 问题 | 现状 | 规范依据 | 方案 |
|---|------|------|----------|------|
| S1 | 筛选行控件高度不齐 | 排程列表页：Input/DatePicker 是 `h-11`，SelectField 触发器默认 `h-8`（components/ui/select.tsx `data-[size=default]:h-8`），同一排高低错位 | Design.md 六：Input/Select Trigger 统一 h-11 | SelectField 默认触发器改 `h-9`（筛选行紧凑档），表单场景继续显式 `h-11`；排程列表页筛选行统一一档 |
| S2 | 硬编码颜色遍地 | 工作台日期条选中态 `#EEF2FF/#6366F1`（靛蓝）、售出进度条 `bg-[#6366F1]`；菜品页 MeatTypeBadge/PortionBadge 约 12 处 `bg-red-100` 等字面量 | Design.md 三：状态/分类颜色一律 CSS 变量，禁止硬编码；主色为暖橙 `--primary` | 工作台选中态/进度条改 `bg-primary/10 text-primary`、`bg-primary`；菜品 badge 色系抽成 `status-* 语义变量类` 语义变量 |
| S3 | 确认弹窗三套并存 | 排程详情删除用原生 `confirm()`（[id]/page.tsx handleDelete）；菜品用 Dialog；选择器用 SelectDialog | Design.md 8.1：交互组件统一 | 排程详情删除改 Dialog（复用菜品页删除弹窗模式） |
| S4 | Tabs 两套实现 | 排程详情手写 border-b 按钮组；`app/components/ui/tab-switcher.tsx` 组件闲置 | 自建组件体系 8.2 | 详情页 3 处 tab 切到 TabSwitcher |
| S5 | 请求模式不统一 | 排程：搜索 300ms 防抖 + 主 effect 双 effect 双请求（storeFilter 变化时防抖 effect 也会触发，同一时刻并发 2 次请求）；菜品：搜索无防抖，每击键一次请求（有 AbortController 取消但仍是每键请求） | 性能规则 | 统一封装 `useDebouncedFetch` 或至少在菜品页加 300ms 防抖；排程合并为单 effect，debounce search 状态 |
| S6 | 加载态高度跳动（CLS） | 工作台切日期时整卡变 `h-64 animate-pulse`，高度跳变；排程列表 skeleton h-24×3 与实际卡片高度接近但空态/加载/有数据三态高度均不同 | 性能：CLS < 0.1，预留空间 | 工作台加载态渲染与有数据态同结构的 skeleton（表头 + 固定行数骨架行）；卡片区块 min-h 固定 |

---

## 一、工作台（app/page.tsx）

### P0-1 日期条选中态配色与品牌主色冲突 【最刺眼】
- 现状：选中日期 `bg-[#EEF2FF] text-[#6366F1]`（靛蓝），售出进度条 `bg-[#6366F1]`，与全局暖橙主色（`--primary: oklch(0.553 0.195 38.402)`）直接打架，整个页面两个主色。
- 方案：选中态改 `bg-primary/10 text-primary`；进度条未售罄改 `bg-primary`，售罄保持 `bg-[var(--status-success)]`；"多 N 份" info 蓝是语义色可保留。
- 参考规范：Design.md 三（主色唯一）、S2。

### P1-2 加载态整卡跳动
- 现状：`{loading ? <div className="h-64 bg-muted rounded-lg animate-pulse" /> : ...}`，切日期/门店时内容区高度剧烈变化。
- 方案：loading 时渲染骨架版卡片（头部占位 + 5 行表格骨架，`animate-pulse`），与有数据态同宽同结构；或仅在表格 tbody 内做行级 skeleton。

### P1-3 复盘表格交互弱
- 现状：原生 `<table>`，行无 hover 态、不可点击；规范要求 Table Row hover `bg-muted/50`。
- 方案：行加 hover 态；点击行跳转 `/dishes?dishId={id}`（菜品页已支持 dishId 深链打开 Sheet，链路可打通）。

### P2-4 汇总 chips 规范化
- 现状：手写 `rounded-full bg-muted px-3 py-1 text-xs`，尺寸与系统 Badge 不一致。
- 方案：抽小组件或改 `Badge variant="secondary"`，营收金额用 success 色 token。

### 已确认做得好的点
- 门店切换持久化 localStorage ✓；URL 深链/周切换选中日期保护逻辑 ✓；未回录不计入统计 ✓；空态有行动入口 ✓。

---

## 二、排程（列表 / 新建 / 详情）

### 列表页

#### P0-4 "快速查看"抽屉是手写 fixed 面板
- 现状：`fixed inset-0 z-50 flex justify-end` + 手写遮罩，无进出动画，遮罩 `bg-black/35`，与系统 Sheet/Dialog 风格脱节；底部 4 个按钮一排，窄屏溢出。
- 方案：整体替换为 `components/ui/sheet`（项目已有 Sheet，菜品页在用）；底部按钮区改主按钮「查看完整详情」+ 收纳其余打印操作为 `outline` 或下拉菜单。

#### P1-5 整卡点击与"快速查看"按钮行为割裂
- 现状：卡片左区点击进详情，右侧独立"快速查看"按钮开抽屉——两个入口层级模糊。
- 方案：整卡（除按钮区）点击 = 进详情（现状保留），"快速查看"按钮 hover 时才高亮；或改为卡片 hover 浮出操作区。二选一，避免双主入口。

#### P1-6 双 effect 并发请求
- 现状：`useEffect(...[storeFilter, startDate, endDate, page])` + `useEffect(setTimeout 300...[search])`，改门店时若搜索框有内容，两个 effect 同时各发一次请求。
- 方案：合并为单一数据 effect，依赖 debounce 后的 search state（参考 S5）。

#### P2-7 无状态维度筛选
- 现状：注释"状态不再是筛选维度，以门店 + 日期为主"，"待生效/进行中"混排。
- 方案（产品决策项）：默认按日期倒序 + 状态排序（进行中/待生效优先），或加回轻量状态筛选。建议先做排序，成本最低。

### 新建 / 编辑页

#### P1-8 基础信息区未接表单规范
- 现状：裸 `Label + Input/DatePicker/SelectField`，提交校验只有 toast（或无校验），无字段级错误；规范要求 FormField（标签+必填+错误）+ 提交滚动到首个错误。
- 方案：接 `FormField/FormError` 体系；标题、生产日期必填校验，错误就近展示。

#### P2-9 已选清单信息密度可提升
- 现状：已选菜品行有数量步进器（好），但无合计成本/份数汇总进 header（份数有，成本无）。
- 方案：header「共 N 份」旁加「预估成本 ¥X」（数据来自各 dish.cost×quantity，前端可算）。

### 详情页

#### P0-10 删除用原生 confirm()
- 现状：`if (!confirm("确定删除此排程？")) return;`
- 方案：改 Dialog 确认（复用菜品删除弹窗样式），与 S3 合并处理。

#### P1-11 手写 Tabs
- 现状：border-b 按钮组手写；项目有 TabSwitcher 未用。
- 方案：切 TabSwitcher，count 徽标保留。

### 已确认做得好的点
- 新建页左右布局（已选清单 + 菜品网格）方向正确；网格选中态 ring 反馈清晰 ✓；状态驱动操作按钮（待生效→确认生产，进行中→完成生产）符合流程 ✓；打印入口齐备 ✓。

---

## 三、菜品（列表 / 详情 Sheet）

### 列表页

#### P0-12 筛选器交互过重（用户痛点级）
- 现状：类别 / 做法 / 状态三个筛选全用 `SelectTileMode`——`h-11` outline 按钮，点开弹**全屏磁贴 Dialog**，"全部状态"只有 2 个选项也要开对话框选磁贴，路径 2 步 + 视觉重。
- 方案：三个筛选全部换成轻量 `SelectField` 下拉（做法 14 项、类别 ≤20 项，下拉完全承载，一步完成）。SelectTileMode 留给表单内的分类/单位/季节选择场景。
- 收益：筛选操作从「点击→等 Dialog→找磁贴→点击」4 步降为「点击→点击」2 步。

#### P1-13 荤素/份量 badge 颜色硬编码
- 现状：MeatTypeBadge、PortionBadge 共 12 处字面量色值，且与工作台/分类标签的变量体系不互通。
- 方案：映射到 `--status-*` 语义变量（荤=danger、素=success、小荤=warning；单人份=info、一锅=warning），多余色档删除。

#### P1-14 搜索无防抖
- 现状：load effect 依赖 `search` 原始值，每击键即请求（AbortController 只能取消不能节流）。
- 方案：300ms 防抖，与 S5 统一处理。

#### P2-15 发布校验失败反馈弱
- 现状：发布前校验失败仅 `toast.error(error)`，用户不知道去哪补。
- 方案：toast 文案带上缺失项，并提供「去完善」操作（跳编辑页）；Sheet 内也可内联展示校验结果区块。

#### P2-16 表格列密度
- 现状：10 列（序号/编号/名称/份量/类别/荤素/成本/售价/毛利率/状态/创建时间），`创建时间` 全格式占宽。
- 方案：`创建时间` 改 `MM-DD HH:mm` 短格式或降列宽；毛利率/成本可对齐 `tabular-nums`。

### 详情 Sheet

#### P1-17 头部操作区拥挤 + 确认弹窗样式
- 现状：header 右侧 3-4 个按钮（发布/下架 + 编辑 icon + 删除 icon），`pr-10` 手动避让关闭钮；确认用 Dialog 而非 AlertDialog 风格。
- 方案：编辑保留 icon；发布/下架为主按钮；删除收进"更多"或保持 icon 但确认弹窗统一（S3）。

### 已确认做得好的点
- `?dishId=` URL 深链同步 Sheet 状态 ✓；行点击开 Sheet + 行操作列 stopPropagation 处理正确 ✓；转化 Dialog 实时倍率/成本预览是全场最佳交互 ✓；删除前引用检查有 toast 提示 ✓。

---

## 四、落地顺序建议

| 批次 | 事项 | 预估 |
|------|------|------|
| 第 1 批（半天） | P0-1 工作台配色、P0-10+S3 删除弹窗统一、P0-12 菜品筛选轻量化、P1-14/S5 搜索防抖、P1-6 双 effect | 纯前端，风险低 |
| 第 2 批（半天） | P0-4 抽屉改 Sheet、P1-11 TabSwitcher、P1-13 badge 变量化、P1-2 工作台骨架、S1 筛选行高度统一 | 纯前端 |
| 第 3 批（1 天） | P1-8 新建/编辑表单接校验体系、P1-5 列表入口统一、P2-15 发布反馈、P2-7 排序策略 | 含小产品决策 |

## 五、规范层面建议补充进 Design.md

1. 筛选控件（列表页工具栏）统一用轻量 Select 下拉；SelectTileMode 仅限表单字段。
2. 确认弹窗统一 Dialog，禁止原生 confirm()。
3. 列表页 Tabs 统一 TabSwitcher 组件。
4. SelectTrigger 控件级默认高度建议升档，避免与 h-11 表单控件混排错位。
