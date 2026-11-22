# 库存管理首页视觉重构 — CC 执行 Spec

> 本文档作为 Claude Code 的完整执行需求输入，涵盖库存管理首页（`/inventory`）视觉重构的 6 项核心需求。请按本文档描述的业务逻辑、交互规范、数据变更要求执行实现，代码层面的设计与执行由 CC 的 plan 模式自主完成。
>
> 当前系统版本：精益厨房 V3 — Next.js 16.2.7 + React 19.2.4 + Tailwind CSS v4 + shadcn/ui v4

---

## 一、需求总览

| 编号 | 需求 | 类型 | 优先级 |
|------|------|------|--------|
| 1 | 页面顶部 KPI 指标看板（4 指标） | 新增 | P0 |
| 2 | 一级分类导航胶囊（横向卡片，仅品种数） | 新增 | P0 |
| 3 | 分类明细区域：食材卡片网格（4 列、无二级分类 badge、悬浮详情浮层） | 新增 | P0 |
| 4 | 搜索 + 视图切换（卡片/列表双视图） | 新增 | P0 |
| 5 | 结构化骨架屏加载状态 | 新增 | P0 |
| 6 | 库存台账 Tab 切换组件复用 | 优化 | P1 |

---

## 二、详细需求说明

### 需求 1：KPI 指标看板（4 指标）

#### 现状问题
当前库存首页无全局指标，用户进入页面后无法一眼感知整体库存状态（有多少品种、有多少预警、今日更新了哪些）。

#### 目标业务逻辑
页面顶部展示 4 个等宽 KPI 指标卡片，数据由前端从现有 API 返回的 `InventoryItem[]` 聚合计算：

| 指标 | 计算规则 | 展示规则 |
|------|----------|----------|
| 当前库存食材种类 | `items.length`（currentQty > 0） | 大数字 + "种" 单位 |
| 低库存预警 | `items.filter(i => i.currentQty < 5).length` | 大数字 + "项" 单位；数值 >0 时卡片图标和数值变色为 `destructive` 红 |
| 临期食材预警 | 占位（依赖保质期模块） | 显示占位符 `—`，标注"待保质期管理模块接入" |
| 今日更新 | `items.filter(i => isToday(i.updatedAt)).length` | 大数字 + "项" 单位 |

#### 涉及范围
- 页面顶部新增 KPI 区块
- 不修改 API，数据从现有 `GET /api/inventory` 返回数组前端聚合

#### 注意事项
- 临期食材预警为**占位功能**，当前数据模型 `Inventory` / `Ingredient` / `PurchaseReceiptItem` 表中均无保质期/过期日期字段，故无法计算真实数据。占位卡片视觉样式与其他 3 张一致，但数据区显示 `—`，底部文案标注数据来源待接入。
- 低库存阈值本版写死为 `5.0`，单位为库存单位（各食材单位不同，不做跨单位换算）。

---

### 需求 2：一级分类导航胶囊（横向卡片，仅品种数）

#### 现状问题
当前仅有一个下拉框筛选二级分类，一级分类无法横向导航，用户需层层展开才能切换分类。

#### 目标业务逻辑
- 在 KPI 看板下方，展示横向排列的一级分类导航胶囊卡片。
- 每个卡片展示：分类图标 + 分类名 + 品种数（如「🥬 蔬菜 · 12 种」）。
- **不展示库存总量**（按产品要求去掉）。
- 第一个卡片为「全部」，展示全部分类的品种总数。
- 点击切换下方明细区域，激活态用 `bg-primary text-primary-foreground` 高亮。
- 无库存的分类 `opacity-50`，但保留可点击，点击后下方显示空状态。

#### 分类列表（从现有数据模型动态生成）
分类从 `IngredientCategoryL1` 表读取，目前包含：蔬菜、肉类、水产、禽类、干货、豆制品、粮油、加工品、调味品。

#### 图标映射（lucide-react）
| 分类 | 图标 | 备注 |
|------|------|------|
| 蔬菜 | `Carrot` | |
| 肉类 | `Beef`（或 `Drumstick`） | 若不存在用 `Circle` 兜底 |
| 水产 | `Fish` | |
| 禽类 | `Bird`（或 `Circle`） | 兜底 |
| 干货 | `Package` | |
| 豆制品 | `Bean`（或 `Circle`） | 兜底 |
| 粮油 | `Wheat`（或 `Circle`） | 兜底 |
| 加工品 | `Factory`（或 `Circle`） | 兜底 |
| 调味品 | `Flame`（或 `Droplets`） | 兜底 |

图标映射在组件内部维护，支持后续扩展。缺失图标时统一回退到 `Circle` 或 `Package`。

---

### 需求 3：分类明细区域：食材卡片网格（4 列、悬浮详情）

#### 现状问题
当前为单一表格，全部食材平铺，无分类聚合、无库存健康度提示、无快捷查看详情入口。

#### 目标业务逻辑

**3.1 二级分类分组标题**
- 明细区域按 `l2Name`（二级分类）分组，每组一个标题行：左侧二级分类名 + 品种数 badge，右侧小计库存量。
- 标题行下方展示该组的食材卡片。

**3.2 食材卡片（4 列网格）**
每张卡片包含：
- 左侧 4px 竖线指示库存健康度（`border-l-4`）
- 食材名（`text-base font-medium`）
- 库存量（`text-2xl font-bold`，视觉权重最高）
- 单位（`text-sm`）
- 库存健康度 badge（充足/正常/低库存）
- 更新时间（相对时间，如"2天前"）

**不展示二级分类 badge**（产品要求：避免与分组标题重复）。

**响应式列数**：
| 断点 | 列数 |
|------|------|
| ≥1280px (xl) | 4 列 |
| 1024-1280px (lg) | 4 列 |
| 768-1024px (md) | 2 列 |
| <768px (sm) | 1 列 |

**3.3 库存健康度规则**
| 状态 | 条件 | 颜色指示 |
|------|------|----------|
| 充足 | `currentQty >= 10` | `border-success`（绿色） |
| 正常 | `5 <= currentQty < 10` | `border-warning`（黄色） |
| 低库存 | `currentQty < 5` | `border-destructive`（红色） |

**3.4 悬浮详情浮层（Hover Tooltip）**
- 鼠标移入卡片后 200ms 延迟展示浮层，移出后消失。
- 浮层位于卡片**上方**（`bottom: calc(100% + 10px)`），带向下箭头指向卡片。
- 浮层展示食材档案**全部字段**（从 `Ingredient` 表读取）：

```
┌─────────────────────────────────────┐
│ 胡萝卜                     CAR-001    │  ← 名称 + 编码（右上角 badge）
│ ─────────────────────────────────── │
│ 名称        胡萝卜                   │
│ 别名        红萝卜                   │
│ 采购规格    500g/袋                  │
│ 采购单位    袋                       │
│ 库存单位    kg                       │
│ 最新参考价  ¥3.50                    │
│ 季节        四季                     │
│ 储存方式    常温                     │
│ 二级分类    根菜类                   │
└─────────────────────────────────────┘
```

- 字段为空时显示 `—`，不隐藏字段行。
- 浮层宽度 `320px`，最大不超过视口宽度 `90vw`。
- 浮层 z-index 高于相邻卡片，确保不被遮挡。

---

### 需求 4：搜索 + 视图切换（卡片/列表双视图）

#### 现状问题
当前搜索框在 CardHeader 内，仅支持逐行过滤表格。无视图切换能力。

#### 目标业务逻辑

**4.1 搜索框**
- 输入时实时过滤（debounce 300ms），匹配：食材名、编码、一级分类名、二级分类名。
- 搜索时自动切换分类导航到「全部」。
- placeholder：`请输入食材名称、编码或分类`（按查询条 placeholder 统一规范）。

**4.2 视图切换**
- 卡片视图 ↔ 列表视图，按钮组位于搜索框右侧。
- 切换时保持当前筛选/搜索状态。
- 列表视图沿用现有 `Table` 组件但增强：新增「库存状态」列（`StatusBadge`）、新增「更新时间」列。

---

### 需求 5：结构化骨架屏加载状态

#### 现状问题
当前 loading 状态为 `animate-pulse` 灰色块，无结构性暗示。

#### 目标业务逻辑
页面加载时展示结构化骨架屏，与最终布局结构一致：
- 4 个 KPI 骨架卡片（等比例占位）
- 搜索框 + 视图切换骨架
- 6 个分类导航骨架胶囊
- 8 个食材卡片骨架块

骨架屏使用 `Skeleton` 组件（shadcn/ui 已安装），带 shimmer 动画。

数据加载完成后（约 1.2s 模拟），骨架屏淡出，实际内容淡入。

---

### 需求 6：库存台账 Tab 切换组件复用

#### 现状问题
Tab 切换为硬编码的 `<button>` 元素，样式与系统组件不统一。

#### 目标业务逻辑
复用系统的 Tab 切换模式，确保「实时库存」/「库存台账」切换按钮与现有页面风格一致。点击「库存台账」跳转到 `/inventory/ledger`（现有页面，不做修改）。

---

## 三、数据模型变更

### 本版无数据模型变更

本版为**纯前端聚合**，复用现有 API `GET /api/inventory`，前端通过 `useMemo` 按 `l1Name` 和 `l2Name` 分组计算。不新增后端接口、不修改 Schema。

> 注意：临期食材预警需后续保质期管理模块提供 `shelfLifeDays` / `expiryDate` 等字段后实现。当前版本仅做占位。

---

## 四、API 接口变更

### 本版无 API 接口变更

复用现有 `GET /api/inventory`，返回结构已满足前端聚合需求：

```ts
interface InventoryItem {
  id: number;
  sourceId: number;
  name: string;
  code: string;
  l2Code?: string;
  l1Name?: string;
  l2Name?: string;
  currentQty: number;
  unit: string;
  updatedAt: string;
}
```

> 后续 MVP4 如需后端聚合端点 `/api/inventory/summary`，另行规划。

---

## 五、交互设计与页面规范

### 5.1 页面整体布局

```
库存管理（/inventory）
├── PageHeader（标题 + 返回按钮 + 描述）
├── Tab 切换（实时库存 / 库存台账）
├── KPI 指标看板（4 卡片等宽 grid）
├── 搜索框 + 视图切换按钮组
├── 一级分类导航（横向胶囊卡片 grid）
└── 分类明细区域
    ├── 二级分类标题行（分组名 + 品种数 badge）
    └── 食材卡片网格（4 列，悬浮详情浮层）
        └── 或列表视图（增强 Table）
```

### 5.2 颜色规范（严格复用 globals.css 语义变量）

| 元素 | 颜色 Token | 说明 |
|------|-----------|------|
| 页面背景 | `bg-background`（oklch(1 0 0) / 白色） | next-themes 管理 |
| 卡片背景 | `bg-card`（白色） | |
| 主要文字 | `text-foreground`（oklch(0.145 0 0) / 近黑） | |
| 次要文字 | `text-muted-foreground`（oklch(0.556 0 0) / 灰色） | 描述、辅助信息 |
| 激活分类 | `bg-primary`（oklch(0.553 0.195 38.402) / 橙棕） + `text-primary-foreground` | |
| 边框 | `border`（oklch(0.922 0 0) / 浅灰） | 卡片、输入框、表格共用 |
| 库存充足 | `border-success`（oklch(0.55 0.15 145) / 绿） | 左侧竖线 |
| 库存正常 | `border-warning`（oklch(0.65 0.15 85) / 黄） | 左侧竖线 |
| 低库存 | `border-destructive`（oklch(0.577 0.245 27.325) / 红） | 左侧竖线 + KPI 数值 |
| 圆角 | `radius-lg`（0.75rem / 12px）卡片，`radius-md`（0.5rem / 8px）按钮 | |

**禁止硬编码任何十六进制色值**，全部使用 CSS 变量或 Tailwind 语义类名。

### 5.3 字体层级

| 层级 | 样式 | 用途 |
|------|------|------|
| 页面标题 | `text-2xl font-bold tracking-tight` | PageHeader |
| 区域标题 | `text-lg font-semibold` | 二级分类标题 |
| 卡片标题 | `text-base font-medium` | 食材名 |
| 大数字 | `text-3xl font-bold` | KPI 数据 |
| 中数字 | `text-2xl font-bold` | 食材库存量 |
| 正文 | `text-sm` | 描述、辅助信息 |
| 微文 | `text-xs` | 更新时间、单位 |

字体：标题/正文 `DM Sans`（`var(--font-sans)`），等宽 `Geist Mono`（`var(--font-mono)`）。

### 5.4 响应式断点

| 区域 | ≥1280px (xl) | 1024-1280px (lg) | 768-1024px (md) | <768px (sm) |
|------|-------------|-----------------|----------------|-------------|
| KPI 卡片 | `grid-cols-4` | `grid-cols-4` | `grid-cols-2` | `grid-cols-2` |
| 分类导航 | `grid-cols-6` | `grid-cols-5` | `grid-cols-4` | `grid-cols-3` |
| 食材卡片 | `grid-cols-4` | `grid-cols-4` | `grid-cols-2` | `grid-cols-1` |
| 搜索区 | 与标题同行 | 与标题同行 | 独立一行 | 全宽 |

### 5.5 新增组件清单

| 组件 | 文件 | 职责 | 复杂度 |
|------|------|------|--------|
| `KpiCard` | `app/components/kpi-card.tsx` | 关键指标卡片（图标 + 数字 + 描述） | 低 |
| `CategoryPill` | `app/components/category-pill.tsx` | 一级分类导航胶囊（图标 + 名称 + 品种数） | 低 |
| `IngredientCard` | `app/components/ingredient-card.tsx` | 单个食材库存卡片（名称 + 库存量 + 健康度 + 更新时间 + 悬浮详情浮层） | 中 |
| `ViewToggle` | `app/components/view-toggle.tsx` | 卡片视图/列表视图切换按钮组 | 低 |
| `InventorySkeleton` | `app/components/inventory-skeleton.tsx` | 整个页面的骨架屏组合 | 中 |

### 5.6 复用现有组件

| 组件 | 来源 | 使用位置 | 备注 |
|------|------|----------|------|
| `PageHeader` | `app/components/page-header.tsx` | 页面顶部 | 已有 |
| `StatusBadge` | `app/components/status-badge.tsx` | 库存健康度 badge | 需扩展 `库存状态` 映射（充足:success, 正常:warning, 低库存:destructive） |
| `EmptyState` | `app/components/empty-state.tsx` | 无数据/无搜索结果 | 已有 |
| `Card` / `CardContent` | `components/ui/card.tsx` | KPI 卡片、食材卡片外壳 | 已有 |
| `Input` | `components/ui/input.tsx` | 搜索框 | 已有 |
| `Skeleton` | `components/ui/skeleton.tsx` | 骨架屏 | 已有 |
| `Table` 等 | `components/ui/table.tsx` | 列表视图 | 已有 |

---

## 六、技术约束与红线

### 6.1 项目安全红线（来自 AGENTS.md）

- ❌ 禁止新增任何 `any` 类型
- ❌ 禁止新增无分页的列表 API（本版纯前端聚合，不新增 API）
- ❌ 禁止在事务中使用 `as any` 绕过类型检查
- ❌ 禁止删除已结算采购单相关的库存台账记录
- ❌ 禁止将 `.env` 文件提交到版本控制

### 6.2 代码提交前强制检查

每次修改代码后，必须按以下顺序执行：

```bash
npx tsc --noEmit
npm run build
npm run lint
```

以上任一步骤失败，不得提交代码。

### 6.3 设计系统一致性

- 颜色全部使用 `globals.css` 语义变量，禁止硬编码十六进制色值。
- 字体使用 `DM Sans`（`var(--font-sans)`）和 `Geist Mono`（`var(--font-mono)`）。
- 圆角使用 `radius-sm` / `radius-md` / `radius-lg` / `radius-xl` 等 token。
- 过渡使用 `transition-all duration-200 ease-default`（`ease-default: cubic-bezier(0.4, 0, 0.2, 1)`）。

### 6.4 其他约束

- 输入校验：搜索框使用 debounce（300ms），无需 zod（纯前端过滤）。
- 操作日志：本版为纯展示页面，无增删改操作，无需 `logOperation`。
- 事务：本版不修改数据库，无需 `prisma.$transaction`。
- Schema 迁移：本版不修改数据库 Schema，无需迁移。

---

## 七、验收标准

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 1 | KPI 看板 | 页面顶部展示 4 个等宽 KPI 卡片，数据正确（种类数/低库存预警/临期占位/今日更新），低库存 >0 时红色高亮 | 视觉检查 + 数据核对 |
| 2 | 分类导航 | 横向展示所有一级分类胶囊，仅显示品种数，点击切换下方明细，激活态正确，无库存分类 opacity-50 | 交互测试 |
| 3 | 食材卡片 | 4 列网格，每张卡片展示名称+库存大数字+单位+健康度+更新时间，无二级分类 badge | 视觉检查 + 响应式测试 |
| 4 | 悬浮详情 | 鼠标移入卡片 200ms 后展示浮层，包含食材全部字段（编码/名称/别名/采购规格/采购单位/库存单位/参考价/季节/储存/二级分类），移出消失 | 交互测试 |
| 5 | 搜索过滤 | 输入实时过滤（300ms debounce），匹配名称/编码/分类，自动切回「全部」 | 交互测试 |
| 6 | 视图切换 | 卡片/列表双视图切换，状态保持，列表视图新增状态列+更新时间列 | 交互测试 |
| 7 | 骨架屏 | 加载时展示与最终布局结构一致的骨架屏，加载完成后交叉淡入 | 视觉检查 |
| 8 | 响应式 | 大屏 4 列卡片 / 中屏 2 列 / 小屏 1 列，分类导航自适应换行 | 浏览器 DevTools 各断点测试 |
| 9 | 视觉一致性 | 无硬编码色值，全部使用 CSS 语义变量；字体 DM Sans + Geist Mono | 代码审查 |
| 10 | 编译构建 | `npx tsc --noEmit` 无错误，`npm run build` 成功，`npm run lint` 无警告 | 命令执行 |

---

## 八、相关文件参考

### 8.1 现有代码（可直接复用或参考）

| 文件 | 说明 |
|------|------|
| `app/inventory/page.tsx` | 当前库存首页，需重构的主文件 |
| `app/inventory/ledger/page.tsx` | 库存台账页，Tab 切换的目标页（不修改） |
| `app/api/inventory/route.ts` | 现有库存 API，本版复用（不修改） |
| `app/components/page-header.tsx` | 页面标题组件，复用 |
| `app/components/status-badge.tsx` | 状态 badge 组件，需扩展 `库存状态` 映射 |
| `app/components/empty-state.tsx` | 空状态组件，复用 |
| `app/globals.css` | 全局 CSS 变量定义（颜色/圆角/字体 token） |
| `app/layout.tsx` | 字体加载（DM Sans / Geist Mono） |
| `prisma/schema.prisma` | 数据模型，`Inventory` / `Ingredient` / `IngredientCategoryL1` / `IngredientCategoryL2` 定义 |
| `components/ui/card.tsx` | shadcn/ui Card 组件 |
| `components/ui/input.tsx` | shadcn/ui Input 组件 |
| `components/ui/skeleton.tsx` | shadcn/ui Skeleton 组件 |
| `components/ui/table.tsx` | shadcn/ui Table 组件 |

### 8.2 设计参考

| 文件 | 说明 |
|------|------|
| `design/PRD-inventory-homepage.md` | 完整 PRD 需求文档（v0.2） |
| `design/prototype/inventory-homepage.html` | 高保真交互原型（可直接浏览器打开验证） |
| `design/prototype/conventions.md` | 原型项目约定（颜色/字体/交互规则） |

---

## 九、边界（不涉及）

- 不修改库存台账页（`/inventory/ledger`）。
- 不修改现有 API（`GET /api/inventory`），本版纯前端聚合。
- 不修改数据库 Schema，不执行 `prisma migrate`。
- 不实现临期食材预警的真实数据（依赖保质期管理模块）。
- 不实现食材卡片点击下钻到详情页（悬浮浮层已覆盖主要需求）。
- 不实现低库存阈值动态计算（本版写死 5.0）。
- 不实现分页/虚拟滚动（库存品种数通常 <200）。
- 不实现空状态引导操作（如"去采购"按钮）。
- 不修改分类颜色硬编码十六进制（`globals.css` 中 `--tag-*` 系列），本版先用，后续暗色模式全局优化时统一修复。

---

> **文档状态**：v0.2 Spec，可直接作为 Claude Code 执行输入。  
> 代码层面的设计与执行，由 CC 的 plan 模式自主完成。
