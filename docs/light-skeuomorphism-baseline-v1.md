# 精益厨房 V3 — 轻拟物视觉规范 v2（落地稿）

> 生效日期：2026-11-20
> 状态：已落地真实代码（首批：食材分类）。像素级参照物：`prototypes/v008-食材分类-完整改造.html`。
> 定位：轻拟物是交互视觉基线 v1 的**视觉升级层**，不改变信息架构、业务语义与操作流程。
> 上游基线：`docs/interaction-visual-baseline-v1.md`（信息架构与组件契约仍然有效）。

## 0. 2026-11-21 推进记录

- **定位**：v008 是主要参照样本，不是逐像素合同。系统按模块推进；看板、单据、打印允许在 v008 语言基础上做模块级扩展。
- **已落地**：暖中性 token（`app/globals.css` `:root`）、输入族统一（Input / Textarea / SelectField / DatePicker / SkeuSearch）、标签族统一（StatusBadge / CategoryTag / PortionTag / ScheduleStatusTag / DishStatusTag）、焦点可见（`--sk-focus`）、`/ui-kit` 新增「v2 材质」Tab。
- **分层现状**：`.skeu-*` 暂留 Tailwind layer 之外。原因：shadcn 原语自带 `bg-input/50`、`border-transparent` 等工具类，直接迁入 `@layer components` 会被工具类覆盖。等按钮 / 输入 / 容器族全部包装完成、页面不再直接使用原语后，再统一迁移；在此之前通过 wrapper 与 variant 控制，不新增 `!important`。
- **系统口径**：标准清单页默认 52px 行高；`dense` 44px 仅作可选变体，不默认启用（启用后行数少时会出现大面积空白）。总数文案 13px、主题色加粗；保留完整页码、去掉首页/尾页按钮；清单行点击查看，编辑走行内按钮。
- **2026-11-21 细节修订**：输入 / 搜索焦点完全对齐 v008——只把边框加深为 `#9CA3AF`，不加发光环；弹窗关闭按钮改为 34px 凸起按钮；Toast 使用系统字体、lucide 线性图标、绝对居中，停用用 warning、启用用 success；空值占位符用短横线 `–` 并降为 40% 透明度；弹窗底栏统一用 `SkeuButton`。
- **页面头部**：一级菜单的标准清单页与二级页面一致，使用 `PageHeader variant="topbar"`（首批：菜品库、原料、单位、食材分类、采购管理占位页、库存）。
- **双 Tab 规则**：顶栏放标题与主操作；第一层页面级 Tab（如库存的当前库存 / 出库单 / 流水）固定在顶栏下方；第二层内容筛选放在面板工具条内，用分段控件；两层不要同时使用全宽下划线样式；页面本身不滚动，只有内容区滚动。
- **多列表页模板（库存样板）**：结构为 `PageHeader topbar` → `skeu-panel` → `PageTabs`（一级）→ 页签内容（`skeu-panel-toolbar` + `DataTable variant="skeu"` + 吸底分页）。一级页签用 `PageTabs`，选中态是橙色磁贴，可选图标与计数；二级筛选用 `SkeuSegmented` 或 `SelectField`，放在工具条内。页签、工具条、分页固定，只有表格区滚动。后续菜品库可把「小碗菜 / 社区 / 食堂」做成一级 `PageTabs`，复用同一模板。
- **筛选控件分工**：选项多或层级型（类别、门店、供应商）用 `SelectField` 下拉；枚举少且互斥（状态、荤素、流水类型）用 `SkeuSegmented` 平铺；搜索用 `SkeuSearch`。低频筛选（如做法）默认不进工具栏，避免工具条拥挤。
- **菜品库（2026-11-21，2026-11-22 两轮升级 + 当日修正）**：一级页签按份量分组——单人份（小碗菜）/ 社区（社区·1–4 份及其余）/ 团餐食堂（小碗菜·10 份）；类别（19+1 项，>10 选项）筛选用 `SkeuListSelect` **无遮罩平铺浮层**（Popover 而非弹窗：全量平铺、一行最多 3 列、**不出现滚动条**、可搜索、点击即生效），荤素回 `SkeuDotSelect` 圆点下拉（与设置模块状态筛选同一标准件），状态保留 `SkeuSegmented`；行操作主操作「菜品转化」按 §4.1 `act-btn.primary` 规格（浅橙底 + 橙描边 + 橙字 + 图标 + 短标签，`SkeuActionButton tone="primary"`）固定最右，编辑 / 复制为幽灵态纯图标；列表去掉类别胶囊列；份量与荤素胶囊共用「同色系底 + **深墨文字（`--capsule-ink`）** + 同色圆点 + `skeu-badge`」——文字不用彩色 ink，色相识别交给底色 + 圆点，与主字段橙彻底解耦（小碗菜 teal、社区 1–4 份 青/蓝/紫/fuchsia、团餐食堂 lime、小荤 rose）；行高 `rowSize="tall"` 60px；默认每页 8 条。表单（new/edit）全面拟物化；用料分组计数胶囊与行内**名称胶囊**按类型着色（主蓝/辅绿/小料琥珀/调料紫/酱红，`BOM_TYPE_TONES`，禁用灰色系），行成本金额加粗；BOM 选择弹窗**完整复用标准列表外框**（`skeu-panel` = 工具条 + 表体 + 吸底分页，与清单页一致；标题与搜索区留间距），分类筛选复用 `CategoryCascadeSelect` 级联弹窗（默认「全部分类」），**选中行浅橙实底 + 左侧主题色描条**（`data-selected` CSS 规则，必须用实色——渐变在行上对比度不足）+ ✓ + 主题色序号。详情为展示型档案**预览**：列表行点击开**正面大弹窗**（`DishDetailDialog`，workbench 1200px，替代旧半屏抽屉），路由页 `/dishes/[id]` 共存并共用同一 `DishDetailBody` 与 `DishDetailActions`（删除 danger / 复制、编辑 outline / 状态主操作 primary，按钮全拟物）；预览只保留**主字段卡片（名称 + 荤素/类别/份量标签，右侧毛利率在左、售价在右）+ 菜品用料**两块，编号与创建时间收进标题区（弹窗标题下、路由页页头），**操作簇完整置于弹窗右下页脚**（删除 danger / 复制、编辑、转化 outline / 状态主操作 primary，与列表操作列全对齐）；删除唯一入口收敛到档案。新建菜品默认份量统一为「小碗菜」（表单初值、存量回退、createDishSchema、dishes 列默认值，迁移 20261122123000；净料/调料档案默认仍为小碗菜·10份）。菜品转化弹窗（`DishScaleDialog`）同步拟物：目标份量平铺磁贴（≤10 选项不走 SkeuListSelect）、已存在/待创建用绿/琥珀 `SkeuChipTag`、底部 `SkeuButton`。
- **三级页面（记录操作）**：默认不新开整页。创建 / 编辑 / 查看详情用 `WorkbenchDialog`，尺寸与「原料清单 → 转净料」弹窗一致：workbench 1200px、`max-h-[calc(100dvh-24px)]`、头部 `px-6 pt-6 pb-4`、底部 `px-6 pt-4 pb-5`，头尾固定、内容区滚动。列表页头主操作与行内「详情」都打开弹窗，成功后就地关闭并刷新当前列表。只有打印、超长多步向导保留独立路由。弹窗底栏用 `SkeuButton`，取消为描边、提交为主色、危险动作为 danger。
- **缺省态**：`EmptyState` 统一为「浮雕图标盘 + 低对比同心环 + 标题 / 说明 + 主操作」；空态由 `DataTable` 直接占满整个列表区（不再放进表格行），加载失败用 `tone="danger"`，列表空态用默认色调。空态、错误态、重试都走同一个组件，不再页面各自拼。
- **下一步**：按钮族 84 文件分批替换 → 清单页逐页铺开 → 单据 / 看板模板扩展 → 打印页单独验收。
- **2026-11-22 简单表收口**：新增 `SimpleListPage` 整页模板与 `DeleteConfirmDialog`，设置 6 个平铺页（单位 / 菜品类别 / 净菜包装 / 门店 / 供应商 / 用户）全部迁入；`SkeuDotSelect` 选中项去掉背景；表单枚举 ≤5 个改平铺；行操作统一「删除→启停→编辑」带文字幽灵态（Power 系图标）。规格见 §0.5.F，`/ui-kit`「标准简单表」样张同步更新。
- **2026-11-22 细节修订**：设置模块主字段改为**只加粗不上主题色**（非业务模块）；配置类枚举统一色标——单位分类（重量橙 / 体积蓝 / 计数紫 / 其他灰）、用户角色（管理员红 / 运营蓝 / 厨师长橙 / 采购绿），列表 `SkeuChipTag`、表单 `SkeuChipSelect`（渐变面 + 按压内凹）；单位新增表单不预选分类、换算克数改为选填；`EmptyValue` 收敛为唯一占位实现并覆盖各列表 / 详情；底栏汇总统一「共 N 条」不带名词后缀。

## 0.5 收束后的系统规范（2026-11-21）

> 这一节是当前唯一判断依据；与上文迭代记录冲突时，以本节为准。

### A. Token 家族

| 家族 | 唯一来源 | 说明 |
|---|---|---|
| 表面 / 层级 | `--sk-surface`、`--sk-surface-muted`、`--sk-panel-body`、`--sk-shadow-1/2/3`、`--sk-highlight-top`、`--sk-inset(-strong)` | 凸起 = 顶部高光 + 底部投影；凹陷 = 顶部内阴影；同一元素不可既凹又凸 |
| 语义状态 | `--status-{success\|warning\|danger\|neutral\|info}` + `-bg` + `-text` + `-dot` | 不再新增 `--sk-status-*`；StatusBadge 只读这一套 |
| 分类色板 | `--tag-*` | 食材 / 菜品分类胶囊 |
| 份量色板 | `--portion-*` + `--capsule-ink` | 份量胶囊；与分类色板同构（bg / dot 按色系，**文字统一 `--capsule-ink` 深墨**）；色相避开主色橙（小碗菜 teal / 社区 1–4 份 青·蓝·紫·fuchsia / 团餐食堂 lime） |
| 荤素色板 | `--meat-*`、`--veg-*` + `--capsule-ink` | 荤红 / 小荤 rose / 素绿（底色 + 圆点，文字同深墨）；`SkeuListSelect`/`SkeuDotSelect` 圆点同色（`--meat-*` 供 `skeu-dot-danger`、`--meat-mixed-*` 供 `skeu-dot-rose`、`--veg-*` 供 `skeu-dot-green`） |
| 主色 | `--sk-primary-from/-to/-ink/-surface/-soft/-shadow` | 按钮渐变、Logo、当前页码都走 token，不写 hex |
| 圆角 | `--sk-radius-xs 8 / sm 10 / md 12 / lg 14 / xl 16 / pill` | 小动作 xs、控件 sm、面板 md、弹窗 lg、图标盘 xl |
| 行高 | `--sk-row-h 52 / -dense 44 / -tall 60`；表头 42 / tall 46 | 默认 52；菜品库 tall 60；仅高密度参照表用 dense 44 |
| 焦点 | `--sk-focus #9CA3AF` | 输入 / 下拉只加深边框；按钮用 2px outline + offset |
| 动效 | 80ms 按压 / 120ms hover / 180ms 展开 | 只动 transform / shadow / opacity；reduced-motion 全关 |

### B. 组件角色

| 场景 | 唯一选择 | 约束 |
|---|---|---|
| 业务按钮 | `SkeuButton` | shadcn `Button` 只允许出现在 shadcn 原语内部；业务页面不再新增 |
| 一级页签 | `PageTabs` | 切换整份列表；橙色磁贴选中态，可带图标 / 计数 |
| 二级筛选 | `SkeuSegmented` / `SelectField` / `SkeuSearch` | 枚举少用分段；选项多用下拉；搜索用 SkeuSearch |
| 详情分区 | `SectionTabs` | 只用于详情页内部，视觉低于一级页签 |
| 列表 | `DataTable variant="skeu"` | 默认 52；`rowSize="tall"` 60；`density="dense"` 44 仅限高密度参照表 |
| 只读大表 | 原生 `Table` | 只允许在打印、预览、详情只读区使用 |
| 记录创建 / 编辑 / 查看 | `WorkbenchDialog` | 1200px、头尾固定、内容滚动；与「转净料」同尺寸 |
| 设置简单表整页 | `SimpleListPage` | 骨架 / 搜索 / 状态筛选 / 分页 / 序号 / 空态全部内置；页面只声明列、行操作与弹窗 |
| 删除确认 | `DeleteConfirmDialog` | 确认态（描边取消 + danger 删除）+ 引用拦截态（无法删除 + 明细 + 引导停用） |
| 简单确认 / 小表单 | `AppDialogContent` compact / form / wide | 取消描边、提交主色、危险 danger |
| 设置 CRUD | `RecordDialog` | 领域包装，内部遵守上面的弹窗与按钮规范 |
| 通用状态 | `StatusBadge` | 只读 `--status-*`；文字 + 圆点，不以颜色为唯一信号 |
| 分类 / 份量 / 荤素 / 排程状态 | `CategoryTag` / `PortionTag` / `MeatTypeTag` / `ScheduleStatusTag` | 各自只读对应色板；DishStatusTag 仅包装 StatusBadge |
| 空态 / 加载 | `EmptyState` / `LoadingState` | 空态占满列表区；错误态 `tone="danger"` |
| 空值占位 | `EmptyValue` | 短横线 + 40% 对比，可带 `title` 说明 |
| 编号 | `CodeText` | 12px、等宽、弱对比；数字统计仍用等宽加粗 |
| 有色枚举 | `SkeuChipTag` / `SkeuChipSelect` | 列表只读 / 表单选择，共用同一色板 |

### C. 页面模板

| 模板 | 结构 |
|---|---|
| 清单 | `panel + topbar` → `ListToolbar` → `DataTable skeu` → 吸底分页 |
| 多列表 | `panel + topbar` → `PageTabs` → 工具条 + `DataTable skeu` |
| 看板 | `panel + topbar` → 列 / 卡片；不使用行高 |
| 单据 / 详情 | `WorkbenchDialog` 或 `panel + topbar` 内容区 |
| 设置 | `panel + topbar` → `DataTable skeu`；简单表不点行查看 |
| 工作台 / 总览 | `panel + topbar` → 卡片 / 周历 |
| 打印 | 平面：无阴影、无渐变，仅字体 / 橙色 / Logo |

### D. 交互规则

1. 简单表不点行查看；编辑 / 删除走行内操作，主操作最右。
2. 菜品、食材等有详情语义的列表可点行打开详情；编辑仍走行内或详情内操作。
3. 创建 / 编辑 / 详情默认大弹窗；成功后就地关闭并刷新当前列表；只有打印和超长向导保留独立路由。
4. 筛选：搜索 `SkeuSearch`；选项多 / 层级型 `SelectField`；枚举少且互斥 `SkeuSegmented`。
5. 确认弹窗：`AppDialogContent compact` + 描边取消 + danger 确认；不再直接用 shadcn destructive。
6. 焦点必须可见；状态不能只靠颜色，必须带文字或圆点。
7. 打印页禁用阴影 / 渐变，单独验收。

### E. 已知收束缺口（按优先级）

1. **按钮双轨**：仍约 61 个业务文件直接使用 shadcn `Button`（设置 6 页已随模板迁移清零），分批迁移到 `SkeuButton`。
2. **直拼表格**：约 14 个业务文件仍用 shadcn `Table` 组件；列表页迁到 `DataTable`，打印 / 详情只读区保留（裸 `<table>` 仅剩 3 处残留）。
3. **确认弹窗**：约 9 处内联确认（设置模块已统一到 `DeleteConfirmDialog`）；抽 `ConfirmDialog` 后统一迁移。
4. **页面骨架**：采购报销、profile 仍未 panel + topbar，按模块迁移。
5. **编号弱化**：约 25 个业务文件仍直接写编号，逐步换 `CodeText`。
6. **空态 / 加载**：仍有约 47 处内联「暂无」，逐步换 `EmptyState` / `LoadingState`。
7. **三级路由**：`purchases/new`、报销新建、菜品新建 / 编辑、排程编辑仍为独立页，后续换 `WorkbenchDialog`；打印路由豁免。
8. **硬编码色板**：食材首页、设置首页、菜品详情、工艺卡片等仍有 hex，逐步换 token。
9. **打印 CSS 重复**：三处打印样式近重复，后续抽共享打印样式。

### F. 设置简单表统一规格（2026-11-22 定稿）

> 用户第一原则：不重复造轮子，简单表在全系统普遍存在，一律走模板复用。

1. **整页模板**：设置类简单 CRUD 清单统一用 `SimpleListPage`
   （`app/components/ui/simple-list-page.tsx`）：panel + topbar 骨架、数据加载
   （`listUrl` 或 `loader`）、搜索（`searchIn` 声明匹配字段）、三态状态筛选、
   分页、序号列与空态全部内置；页面只声明 `columns`、`rowActions(row, ctx)`
   与弹窗（children 可为函数拿 `ctx.refresh`）。已接入：单位、菜品类别、
   净菜包装、门店、供应商、用户。食材分类为树形特化页，不进模板，只复用原子件。
2. **行操作**：带文字幽灵态 `SkeuActionButton`，从左到右固定顺序
   排序（纯图标 `SkeuIconAction`，仅树形）→ 删除（danger 红 / Trash2）→
   启停（停用 warn 琥珀 / PowerOff，启用 ok 绿 / Power）→ 编辑（default / Pencil），
   行内主操作（fill）最右。三操作列宽 `w-[260px]`，两操作 `w-[180px]`，
   树形六操作 `w-[380px]`。
3. **状态筛选**：`SkeuDotSelect` 三态圆点（全部灰 / 启用中绿 / 已停用琥珀）；
   选中项**无背景**，加粗 + 右侧勾（2026-11-22 修订）。
4. **表单枚举**：选项 ≤5 个平铺；有识别色的枚举（单位分类、用户角色）用
   `SkeuChipSelect` 彩色选择片（白到色的渐变面 + 顶部高光，选中为按压内凹 + 深一档描边），
   列表同值用 `SkeuChipTag`，两者共用同一色板；无语义色的短枚举（门店状态）用 `SkeuSegmented`。
   >5 个用 `SelectField` 下拉。**新增表单不预选默认值**（如单位分类留空，必须由用户选择）；
   单位换算克数为**选填**，仅重量类展示、填写后参与换算。
5. **值排印**：业务列表主字段（名称 / 姓名）统一 `font-semibold text-primary`；
   **设置等非业务模块主字段只加粗**（`font-semibold`，不上主题色）。
   编号用 `CodeText`；数字统计等宽。空值一律用 `EmptyValue`（短横线 + 40% 对比），
   禁止各模块自建 `—` 文本。
6. **底栏汇总**：只显示「共 N 条」，**不带业务名词后缀**，13px 主题色加粗。
7. **列宽口径**（`DataTable` 的 `className` 逐列声明，无全局默认）：
   序号 48 / 编号 90–110 / 主字段 120–200 / 中间字段 100–140 / 状态 100 /
   操作 180（两个动作）、260（三个动作）、380（树形六动作）；
   **长文本列（说明 / 备注 / 地址）不设宽度**，自适应吃掉剩余宽度。
8. **删除确认**：`DeleteConfirmDialog` 统一——确认态「取消描边 + 删除 danger」；
   被引用拦截态「无法删除 + 引用明细 + 引导改停用」。
9. **启停反馈**：停用 `toast.warning`（琥珀）、启用 `toast.success`（绿），文案带实体名。

## 1. 强度边界

- 只做「轻拟物」：柔和阴影 + 表面高光 + 按压反馈，**不做**材质纹理、玻璃拟态、深度立体。
- 理由：厨房一线环境强光、油污、触屏操作，深度拟物更易显脏、更难辨识。
- 暗色模式本轮不做，`globals.css` 未启用 `.dark` 主题，保持现状。
- 品牌色只用于按钮、选中态与状态信息，不铺大面积。

## 2. 工程落地方式（本轮确立的硬约束）

### 2.1 禁止手改 shadcn 原语

`components/ui/**` 由 shadcn CLI 托管（见 AGENTS.md），**不得手写修改**。拟物化只能落在两处：

| 层 | 位置 | 职责 |
|---|---|---|
| Token 层 | `app/globals.css` 末尾「轻拟物视觉层」段 | CSS 变量、`.skeu-*` 组件类 |
| 包装层 | `app/components/ui/skeu-*.tsx` | 包裹 shadcn 原语的业务级组件 |

### 2.2 优先级约定

- `.skeu-*` 规则**写在 Tailwind 各 `@layer` 之外**（文件末尾），因此优先级高于所有工具类，
  可覆盖 shadcn 组件自带的 `shadow-sm`、`bg-card` 等；代价是页面级工具类无法再覆盖 `.skeu-*`。
- 需要的差异用更具体的 `.skeu-*` 变体表达，不在页面里写 `!important`。

### 2.3 Token 清单

阴影阶梯 `--sk-shadow-1/2/3`；高光 `--sk-highlight-top`；内凹 `--sk-inset` / `--sk-inset-strong`；
描边 `--sk-border` / `--sk-border-strong`；表面 `--sk-surface` / `--sk-surface-muted` / `--sk-panel-body`；
主色表面 `--sk-primary-surface` / `--sk-primary-soft` / `--sk-primary-shadow`；
行底色 `--sk-row-hover`（#FDF9F5）/ `--sk-row-l2`；滚动条 `--sk-scroll-thumb`。

Tailwind 侧通过 `@theme inline` 映射为 `shadow-sk-*`、`border-skeu-*` 工具类。

## 3. 框架层

### 3.1 滚动模型（不变）

标准清单页**外层不出现滚动条**：页面容器锁定视口高度，唯一的滚动发生在表格区（panel-body）。

- 现状已满足，本次改造不改动滚动模型：`PageShell variant="panel"` = 固定顶栏 + 内容区，
  内容区 `min-h-0 flex-1`，表格 `DataTable fillHeight` 在可用空间内滚动。
- 表头 sticky，工具条与分页固定在面板内，滚动时不漂移。

### 3.2 页面形态

| 形态 | 组件 | 说明 |
|---|---|---|
| `content` | `PageShell variant="content"` | 整页滚动，用于表单页、详情页 |
| `workspace` | `PageShell variant="workspace"` | 锁定高度的工作台（菜品编辑等） |
| `panel` | `PageShell variant="panel"` | **新增**：整宽固定顶栏 + 唯一滚动面板，标准清单页使用 |

顶栏用 `PageHeader variant="topbar"`：白表面 + 暖灰下边框 + 二段式阴影，三段式结构
（返回按钮 / 标题+描述 / 操作区）。顶部**不放**发光条。

### 3.3 一级菜单（侧栏）

- icon 不变。
- 选中态 = 橙色按压浮雕磁贴（`--sk-primary-soft` 渐变底 + 内高光 + 投影）+ 橙字 + 右侧圆角缺口。
- **无左侧指示条、无发光条**（v006 原型有，v008 已删除，以 v008 为准）。
- 品牌 Logo 改为橙色渐变 + 顶部高光 + 投影。

## 3.5 表格与行操作（v008 实测值，已在浏览器核对）

| 项 | 规格 |
|---|---|
| 单元格 | `padding: 0 16px`，行高 52px，正文 14px |
| 表头 | `padding: 12px 16px`，12px / 600 / muted-foreground，底色 `--sk-surface-muted` + 顶部内高光 |
| 行分隔线 | 1px `--sk-border`（`#E7E5E0`），**不得**用 `border-b` 默认的 currentColor |
| 行底色 | 一级白底、二级 `--sk-row-l2`（#FCFBF9）、悬浮 `--sk-row-hover`（#FDF9F5） |
| 列宽 | 序号 64 / 编号 150 / 名称 160 / 说明 220 / 状态 110 / 操作 380 |
| 二级行 | 编号列左空 26px、名称左缩进 26px；二级编号文字用 muted-foreground |
| 说明列 | 单行 nowrap + 省略号 + title 全文 |

行操作三形态（顺序：排序 → 删除 → 启停 → 编辑 → 主操作，主操作最右）：

| 形态 | 规格 | 用途 |
|---|---|---|
| 纯图标 | 40×40、圆角 9px、16px 图标、hover `#F3F1EC` + 轻投影、悬浮出深色提示气泡 | 上移 / 下移 |
| 带文字 | 高 34px、圆角 8px、12px 文字 + 14px 图标、幽灵态；删除红字 / 停用琥珀字 / 启用绿字 | 删除 / 启停 / 编辑 |
| 行内主操作 | 同上加浅橙底 `#FBE7DC` + 橙字 `#C2410C` + 橙描边 `#F5B48D` + 内高光 | 添加二级 |

## 3.6 弹窗与表单（v008 实测值）

- 弹窗宽 560px、圆角 **14px**、阴影 `--sk-shadow-3`。
- 标题 18px / 700；字段标签 **14px / 600**，必填星号为 destructive 色。
- 输入控件 44px 高、圆角 10px、描边 `--sk-border-strong`、内凹 `--sk-inset`；
  聚焦只把边框变 `#9CA3AF`，**不加发光环**。

## 4. 组件契约

新增（`app/components/ui/`）：

| 组件 | 用途 | 关键约定 |
|---|---|---|
| `SkeuButton` | 拟物按钮 | variant：primary / outline / secondary / ghost / danger |
| `SkeuToggle` | 拨动开关 | 内凹轨道 + 立体圆钮；用于「全部展开 / 收起」等状态语义开关 |
| `SkeuDotSelect` | 圆点状态筛选 | 圆点三色（全部灰 / 启用中绿 / 已停用琥珀）；选中浅橙底 + 勾 |
| `SkeuListSelect` | 平铺浮层下拉（**仅选项 >10 个的枚举筛选**，如菜品类别） | 无遮罩 Popover 而非弹窗；磁贴全量平铺、一行最多 3 列、**不出现滚动条**；可搜索；点击即生效；首项「全部」；触发器为 skeu-trigger 标准件。**选项个数分工：≤5 个（如门店）直接用普通下拉 `SkeuDotSelect`，不上平铺浮层**；6–10 个用 `SkeuDotSelect` / `SkeuSegmented`；>10 个才用本组件 |
| `SkeuSearch` | 搜索框 | 内凹、无聚焦发光；有内容时右侧圆形清除钮 |

改造：

- `ListToolbar` → 使用 `SkeuSearch`，重置按钮用 `SkeuButton variant="ghost"`。
- `StatusBadge` → 胶囊 + 顶部内高光 + 轻微投影 + 语义圆点。
- `DataTable` → 新增 `variant="skeu"`（默认 `default`，逐页灰度接入）、`getRowLevel`（树形行层级）与 `isRowSelected`（选择弹窗选中行浅橙实底 + 左侧主题色描条，走 `data-selected` CSS 规则）。
- `Pagination` → 拟物翻页按钮 + 当前页橙色胶囊。
- `form-controls.Input` → 全局内凹拟物（低风险，全站生效）。

### 4.1 操作列（不变）

- 每行只有一个主操作，层级低于页面主操作；一级行有「添加二级」，二级行不设主操作。
- 顺序按频率降序，从右到左：主操作 → 编辑 → 启停 → 删除 → 排序。
- 主操作为浅橙底 + 橙描边 + 橙字 + 图标 + 短标签（`act-btn.primary` 规格）。
- 其余动作为幽灵态纯图标按钮，保留悬浮 tooltip。

## 5. 树形列表

- 一级行白底、二级行浅灰底；两级的行悬浮浅橙高亮都必须生效。
- 展开/收起用 `SkeuToggle` 统一控制，默认收起，置于工具栏右侧。
- 展开按钮保留在编号列前，避免改变列语义。

## 5.4 列表页密度与分页（v2 定稿，与系统既有约定一致）

> 说明：v008 只是**样式参照**，不是像素规范。以下数值以「系统可用性优先」定稿，
> 与 v008 不同处已注明原因。

| 项 | 定稿 | 与 v008 的差异 |
|---|---|---|
| 行高 | **44px** | v008 为 52px；厨房场景一屏要看到更多行，44px 仍满足触控可读 |
| 每页条数 | **沿用系统默认 10 条/页**（默认分页是功能，不在拟物改造里改） | v008 也是 10 |
| 底栏汇总 | **只报总量**「共 N 条」，用**主题色 + 加粗**，不带单位后缀 | v008 同为「共 N 个」；不再显示「第 X-Y 条」区间 |
| 页码 | **完整页码列表**：当前页橙色胶囊，首页/尾页始终可见，页数多时中间省略号 | v008 只显示当前页；系统要求两页时两个页码都要可点 |
| 每页条数控件 | 胶囊「N 条/页」 | v008 同 |
| 首页/尾页按钮 | **不单独提供**（基线沿用「只保留上一页、页码和下一页」） | — |

### 行操作三级

| 层级 | 用途 | 样式 |
|---|---|---|
| 默认 | 删除 / 启停 / 编辑 | 幽灵态灰字，hover 浅灰底 |
| soft | 「添加二级」这类新增动作 | **描边式**：1px 橙边 + 透明底 + 橙字，hover 浅橙底（比 primary 填充再降一级，且视觉完整） |
| primary | 预留，行内主操作需显式指定 | 浅橙底 + 橙字 + 橙描边 |

### 排序规则（清单页）

- 搜索或筛选生效时**禁用排序**（部分行被隐藏，上下移动语义不明确），提示「搜索或筛选时不可排序」。
- **跨页移动禁用**：目标位置若不在当前页，移动后当前页看不到任何变化；
  提示「已在本页末位，跨页排序请先调整每页条数」。
- 二级分类排序用**父级内的全局序号**判定首尾，不能用分页内序号。
- 排序是低频操作，用纯图标 + tooltip，不占行内主要视觉层级。

### 表格高度

- 面板**撑满可用高度**，工具条固定在顶部、分页吸底在面板底部（参照 demo）。
- 行高 `--sk-row-h` = **52px**（demo 原值），表头高 `--sk-thead-h` = 42px。
- 内容放得下时表格区不出现滚动条；**内容超出时允许出现表格区滚动条**（只滚表格区，
  页面本身永远不出现滚动条）。
- 不做「空白区填格线」之类的补偿：末行与分页之间的空隙是正常留白，不额外处理。
- 注意：`table/tbody { height: 100% }` 会把多余高度分摊给行（实测行高被拉伸），**不可用**。

### 刷新与抖动

- 列表刷新时**保留旧数据**，不把 loading 态渲染成空表（否则整表塌陷再撑开，出现列表抖动）。
  loading 只用于首次进入。

### Toast

参照 v008：顶部居中（距顶 84px）、白色圆角面板（12px 圆角 + 三级阴影）、
左侧 **30px 圆形渐变状态图标**（成功绿 / 失败红 / 警告琥珀）、文案 14px/600、图标与文字间距 10px。

用 sonner 实现时必须覆盖两处默认样式，否则与参照差别明显：
1. sonner 把图标槽固定为 16px，会让 30px 圆球溢出并压住文字 → 需放开 `[data-icon]` 到 30px；
2. sonner 给 toast 固定 356px 宽 → 需 `width: max-content` + `margin: 0 auto` 让它贴合内容并居中。

## 5.5 两个已踩过的坑（重要）

1. **Tailwind 的 `bg-[var(--x)]` 只能设 `background-color`**：当 `--x` 是渐变时整条声明失效、
   元素变透明。渐变表面必须走 CSS 类（本轮新增 `.skeu-surface` / `.skeu-surface-muted`），
   或用 `bg-[image:var(--x)]`。
2. **本地走查必须用 `http://localhost:<port>`，不能用 `127.0.0.1`**：
   Next.js 16 dev 会拦截跨源 dev 资源请求（`allowedDevOrigins` 未放行时），
   客户端 JS 被拦截 → 页面不水合 → 只显示 SSR 的空骨架，交互全部失效。
3. **base-ui 的 `TooltipTrigger` 会吞掉 `disabled` 属性**（只留 `data-trigger-disabled`），
   按钮在 DOM 上仍可点击。凡是「首条不可上移」这类限制，必须用 `render` 自绘原生 `<button disabled>`，
   否则限制形同虚设。
4. **改 `globals.css` 后必须清 `.next/dev` 再重启 dev server**：
   Turbopack 会缓存旧 CSS，磁盘上已改但浏览器命中的仍是旧规则
   （本轮就出现过「代码写 44px、浏览器命中 52px」）。
   流程：停 dev server → 删 `.next/dev` → 重启。生产模式则需重新 `npm run build`。

## 6. 验收口径

1. `npx tsc --noEmit` 通过。
2. `npm run lint` 无新增告警（尤其 `max-w-[...]`、`text-[9px]` 两条限制）。
3. 标准清单页在桌面宽度下：外层无滚动条，仅表格区滚动，表头与分页不漂移。
4. 与 `prototypes/v008-食材分类-完整改造.html` 逐项比对（框架、工具条、表格、操作列、分页）。

## 7. 铺开计划

- **P0** token + 基线（本文档）✅
- **P1** 基座组件（`skeu-*`）✅
- **P2** 框架层（panel 形态、顶栏、侧栏磁贴）✅
- **P3** 样板页：食材分类（`app/settings/classes`）✅
- **P4** 全站铺开：食材库 → 菜品 → 排程 → 生产 → 库存 → 采购 → 设置，
  逐页把 `DataTable variant` 切到 `skeu`、把 `PageShell` 切到 `panel`。
## 8. 2026-11-21 设置模块升级

- **一级页面标题**：所有一级菜单页面统一 `PageShell variant="panel"` + `PageHeader variant="topbar"`，标题、描述、主操作与二级页面一致；看板页的内容区由 `min-h-0 flex-1 overflow-auto` 承担滚动。
- **简单表去查看**：设置类简单 CRUD 表（单位、食材分类、菜品类别、净菜包装、门店、供应商、用户）移除行点击查看；编辑统一走行内「编辑」操作。
- **树形列表**：食材分类点击一级行即展开/收起，且同一时间只展开一个；二级行不触发展开，光标恢复默认。
- **编号弱化**：列表中的编号/编码统一用 `CodeText`（12px、等宽、70% 对比），不再使用 `font-medium`；数字统计仍保留等宽加粗。
- **一级页面清单**：菜品库、食材库、库存、采购、排程、生产计划、内部生产单、工作台、设置。

## 9. 2026-11-22 食材库标准表

适用：原料 / 净料 / 小料 / 调料四个清单页；食材库首页不改。

### 9.1 查看与编辑入口

- **行点击 = 查看**：打开详情抽屉的只读态。
- **操作列「查看」= 主操作**：浅橙底 + 橙字主按钮，放在最右。
- **「编辑」= 辅助图标**：直接打开抽屉的编辑态；抽屉内仍可再切编辑 / 取消。

### 9.2 操作列（最多三个）

| 位置 | 形态 | 内容 |
|---|---|---|
| 左 | 辅助图标 | 至多两个：编辑 / 打印标签 / 转净料 / 转调料 |
| 右 | 主操作（文字） | 查看 |

- 复制、删除等**危险或低频动作不进列表**，收进详情抽屉底部操作区（抽屉已有删除 / 复制 / 关联菜品 / 转料）。
- 列宽 `w-[200px]`；图标用 `SkeuIconAction`，主操作用 `SkeuActionButton tone="primary"`。

### 9.3 分类筛选器（`CategoryFilter`）

- **一二级分类**用同一个轻拟物触发器 + 弹层分栏：左栏一级分类（带二级数量），右栏该一级下的二级网格；选一级不关闭，选二级关闭。
- **选项超过 5 个自动出现搜索框**，替代长下拉；不再并排两个原生下拉。
- 只有二级的清单（小料 `MIN`、调料 `SEA`）传 `fixedL1`，退化为单栏二级选择。
- 触发文案：一级已选显示一级名，二级已选显示「一级 · 二级」，未筛选显示占位；弹层内提供「清除筛选」。

### 9.4 值与汇总

- 主字段（名称）`font-semibold text-primary`；编号 `CodeText`。
- 空值统一 `EmptyValue`（短横线 + 40% 对比），不再手写 `—`。
- 底栏汇总只显示「共 N 条」，不带业务名词后缀。

## 10. 2026-11-22 排程模块拟物件

适用：去排菜弹窗（`schedule-create-dialog`）与排程看板卡片（`schedule-card`）。规格样张见 `/ui-kit`「v2 材质 → 排程拟物件」。

### 10.1 菜品选择卡（`.skeu-dish-card`）

- 菜品库网格单元：暖白纸面 + 顶部高光，hover 上浮 1px，active 下压内凹。
- 选中态 `data-on="true"`：橙粉纸面（`--sk-primary-soft` 同源）+ 描边 `#f5b48d`，右上角单选圆点 `.skeu-pick-dot` 打勾。
- 卡内信息：分类（中性灰识别片，不带分类色）、菜名、编号（等宽）、份量 `PortionTag`、售价（`font-mono` 右对齐）。

### 10.2 已选卡（`.skeu-picked-card`）

- 绿纸面（`#f5fbf7 → #e9f4ee`）+ 4px 左色条，表达「已入菜单」。
- 行内步进器用 `SkeuButton size="icon-sm" variant="outline"`；份数为 `.skeu-input` 内凹小输入。
- **排序规则：最新选中的排最前**（`toggleDish` 用 unshift；复制来源保留原单顺序）。

### 10.3 筛选片（`.skeu-fchip`）

- 筛选浮层内的条件片：中性底凸起，`data-on="true"` 切橙粉软底。
- 仅用于浮层分组筛选（类别 / 份量 / 售价），不替代 `SkeuDotSelect`（状态语义）与 `SkeuChipSelect`（取值自带识别色）。

### 10.4 排程索引卡（`.skeu-index-card`）

- 看板卡片形态：卡册舌 `.skeu-index-tab` + 状态色头部 `.skeu-index-head` + 日期盒 `.skeu-datebox`。
- 三态（待生效 / 进行中 / 已完成）用 `data-status` 驱动整套 CSS 变量（`--ic-*`），**着色只落舌片与头部，卡身保持中性纸面**。
- 菜品预览默认前 3 行，超出「还有 N 道 / 查看更多」行内展开。

### 10.5 排菜模块交互收口（2026-11-23）

- **改菜单 = 去排菜弹窗编辑态**：看板卡片「改菜单」与详情页「修改」都打开 `schedule-create-dialog` 的 `editId` 模式（加载原单回填、PUT 保存），不跳独立编辑页；原 `/schedules/[id]/edit` 路由与 `ScheduleForm` 已下线。复制仍走 `copyFromId`（新建 POST）。
- **卡片主操作降一级**：看板卡片上「确认生产」用 `SkeuButton variant="outline"`（与「改菜单」同级），主色只留给弹窗内提交按钮。
- **日期盒 `.skeu-datebox`**：宽度随内容自适应（栅格列 `auto` + `white-space: nowrap`），「N月 · 周X」必须一行；整体 50px 高、日数字 19px。
- **门店筛选选项个数分工**（已并入 §0 组件表 `SkeuListSelect` 条目）：≤5 直接下拉（`SkeuDotSelect`），>10 才用平铺浮层。
- **打印入口**：排程详情只保留「打印切配工单」（`?doc=cutting`），门店点菜单打印模板已删除。

### 10.6 看板状态列宽与卡片密度（2026-11-23）

适用：排菜（`/schedules`）、生产计划单（`/production-plans`）、内部生产单（`/self-production-orders`）共用的状态看板 `KanbanBoard`。

- 看板行**固定 3 栅格**（`lg:grid-cols-3`），不随可见列数改成 2 栅格或 1 栅格。
- 三列全显：各 1/3，卡片单列纵向堆叠（现状不变）。
- 关掉一列：剩余两列**不均匀拉伸**——被关列的 workflow 上游邻列（枚举顺序 `待生效 → 进行中 → 已完成` 的循环左邻）扩为 2/3，另一列保持 1/3；扩宽的列内卡片**两列平铺**。
  - 关「已完成」→「进行中」2/3；关「进行中」→「待生效」2/3；关「待生效」→「已完成」2/3。
- 只剩一列：撑满整行（3/3），列内卡片**三列平铺**。
- 卡片平铺只为保持卡片恒定舒适宽度（约 420–450px），窄屏（<lg）始终单列。
