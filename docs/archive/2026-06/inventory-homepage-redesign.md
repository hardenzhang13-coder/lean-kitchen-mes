# 库存管理首页 — 前端设计方案

> 使用技能：`frontend-redesign`（ui-ux-pro-max）  
> 项目：精益厨房 V3 — Next.js 16.2.7 + Tailwind CSS v4 + shadcn/ui v4  
> 设计目标：清晰展示当前各类别食材的库存数据

---

## 1. 当前现状审计

### 1.1 技术栈

| 维度 | 版本/状态 | 备注 |
|------|-----------|------|
| 框架 | Next.js 16.2.7 | ⚠️ 最新版本，存在 breaking change 风险 |
| React | 19.2.4 | ⚠️ 新特性可能与旧库不兼容 |
| Tailwind CSS | v4 | `@theme inline` 在 globals.css 中定义，无 tailwind.config.ts |
| shadcn/ui | v4 | 基于 `@base-ui/react`，使用 `rounded-2xl`、`ring-foreground/5` 等新约定 |
| 主题 | next-themes 0.4.6 | 支持暗色模式，CSS 变量驱动 |
| 字体 | DM Sans + Geist Mono | 通过 next/font 加载，CSS variable 映射 |

### 1.2 现有库存首页结构（`/app/inventory/page.tsx`）

当前页面是**单一扁平表格**结构：

```
PageHeader (标题 + 返回按钮)
  └── 二级 Tab 切换 (实时库存 / 库存台账)
Card
  ├── CardHeader (搜索 + 二级分类筛选 + 清除按钮)
  └── CardContent
      ├── Loading 状态 (animate-pulse 占位)
      ├── Empty 状态 (Package icon + "暂无库存数据")
      └── Table (5 列：食材名称 / 一级分类 / 二级分类 / 当前库存量 / 计量单位)
```

### 1.3 数据模型

```
Inventory ──▶ Ingredient (id, name, code, l2Code, stockUnit)
    │
    └── currentQty, unit, updatedAt

IngredientCategoryL2: code, name, parentCode
IngredientCategoryL1: code, name
```

当前 API (`/api/inventory`) 返回 `InventoryItem[]` 数组，包含：
`id, sourceId, name, code, l2Code, l1Name, l2Name, currentQty, unit, updatedAt`

---

## 2. 核心问题诊断

### 2.1 信息架构问题（❗ 最高优先级）

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| **缺少分类聚合视图** | 🔴 P0 | 用户核心需求是"清晰展示各类别食材的库存数据"，但当前纯表格无法按分类快速概览。所有食材平铺，无一级分类汇总卡片。 |
| **缺少关键指标看板** | 🔴 P0 | 没有库存总品种数、总库存量、低库存预警数、最近更新时间等关键指标，用户无法一眼感知全局状态。 |
| **二级分类筛选低效** | 🟡 P1 | 仅有一个下拉框选择二级分类，一级分类无法横向导航，需层层展开才能切换。 |

### 2.2 视觉层次问题

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| 表格视觉权重单一 | 🟡 P1 | 库存量、分类 badge 等无差异化视觉处理，重要信息淹没在密集行中。 |
| 分类 badge 颜色与全局 token 不统一 | 🟡 P1 | 使用 `var(--info-muted)` 和 `var(--success-muted)`，但 `globals.css` 中定义的 `--info-muted` 为语义化命名（信息色），实际分类需要按食材类型着色（如蔬菜绿、肉类红等）。 |
| loading 状态简陋 | 🟢 P2 | `animate-pulse` 灰色块，缺少骨架屏的结构性暗示。 |
| 空状态无引导操作 | 🟢 P2 | 纯展示图标和文案，无"去采购"或"导入食材"的引导按钮。 |

### 2.3 交互问题

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| 无分类卡片切换 | 🟡 P1 | 用户无法点击某个分类后快速查看该分类下食材。 |
| 无库存预警状态 | 🟡 P1 | 不区分库存健康度（充足/正常/低库存），需人为扫表判断。 |
| 搜索范围不直观 | 🟢 P2 | 搜索框在筛选区，但用户不确定搜索的是食材名、编码还是分类。 |

---

## 3. 设计方案

### 3.1 设计目标

1. **一屏可见分类概览**：用户进入页面后，无需滚动即可看到各一级分类的库存概要。
2. **分类即入口**：点击一级分类卡片后，下方展开该分类的详细食材列表。
3. **关键指标一目了然**：顶部数据看板提供全局库存健康度快照。
4. **保持设计系统一致性**：使用现有 `globals.css` 变量、shadcn/ui v4 组件、PageHeader 等共享组件。

### 3.2 信息架构（新）

```
PageHeader (标题 + 实时库存/库存台账 Tab 切换)

Section: 关键指标看板 (KPI Cards — 4 列)
  ├── 总库存品种数
  ├── 总库存量
  ├── 低库存预警数
  └── 今日更新数

Section: 一级分类导航 (Category Nav — 横向胶囊卡片)
  ├── 全部 ▪ 品种数 · 总库存量
  ├── 蔬菜 ▪ 品种数 · 总库存量
  ├── 肉类 ▪ 品种数 · 总库存量
  ├── 水产 ▪ 品种数 · 总库存量
  ├── ... (其他一级分类)
  └── 搜索结果覆盖时自动切换为"全部"

Section: 分类明细区域 (Dynamic Detail Panel)
  ├── 二级分类标题行 (二级分类名 + 该分类食材数 + 小计库存量)
  └── 食材卡片列表 (Grid Layout，非表格)
      ├── Card (食材名 · 库存量 · 单位 · 二级分类 badge · 库存健康度指示)
      ├── Card
      └── ...

Section: 搜索/筛选 (吸顶或始终可见)
  ├── Search Input (搜索食材名、编码、分类)
  └── 视图切换：卡片视图 / 列表视图 (表格)
```

### 3.3 布局详细规范

#### 3.3.1 整体布局

```
页面内边距：p-8（与现有页面保持一致）
内容区最大宽度：无限制（flex-1），但内部卡片建议 max-w-7xl 居中
全局 gap：gap-6
```

#### 3.3.2 关键指标看板 (KPI Cards)

- **布局**：4 列等宽 grid，`grid-cols-4 gap-4`
- **响应式**：md 以下 `grid-cols-2`，sm 以下 `grid-cols-1`
- **卡片样式**：`Card` + `CardContent` + `p-6`
  - 每个卡片顶部：图标 + 标题（text-sm text-muted-foreground）
  - 中间：大字号数据（`text-3xl font-bold tracking-tight`）
  - 底部：对比数据或趋势（`text-sm text-muted-foreground`，如"较昨日 +3"）
- **图标**：使用 `lucide-react` 语义图标
  - 品种数 → `Tags` 或 `Layers`
  - 总库存量 → `Scale`
  - 预警数 → `AlertTriangle`（当 >0 时图标颜色为 `text-destructive`）
  - 今日更新 → `Clock`

#### 3.3.3 一级分类导航卡片

- **布局**：横向滚动或自动换行，`flex flex-wrap gap-3` 或 `grid grid-cols-6`
- **卡片样式**：
  - 默认：`bg-card border hover:bg-muted/50 transition-colors cursor-pointer`
  - 激活：`bg-primary text-primary-foreground border-primary shadow-sm`
  - 内边距：`p-4`
- **内容结构**：
  ```
  ┌─────────────────┐
  │  🥬 蔬菜         │  ← 图标 + 分类名 (text-sm font-medium)
  │  12 种 · 45.3 kg │  ← 品种数 + 库存总量 (text-xs text-muted-foreground)
  └─────────────────┘
  ```
- **图标映射**：每个一级分类配置一个 `lucide-react` 图标
  - 蔬菜 → `Carrot` 或 `Leaf`
  - 肉类 → `Beef`（自定义图标）或 `Drumstick` 或 `CircleDot`
  - 水产 → `Fish`
  - 干货 → `Package`
  - 调味品 → `Flame` 或 `Droplets`
  - 其他 → `Circle`
- **缺省处理**：如果某个分类下无库存，卡片置为 `opacity-50`，但保留可点击，点击后显示空状态。

#### 3.3.4 分类明细区域

- **二级分类标题行**：`flex items-center justify-between py-4`
  - 左侧：二级分类名（`text-lg font-semibold`）+ 该分类食材数 badge
  - 右侧：小计库存量（`text-sm text-muted-foreground`）
- **食材卡片列表**：`grid grid-cols-3 gap-4`
  - 响应式：lg `grid-cols-3`，md `grid-cols-2`，sm `grid-cols-1`
- **食材卡片设计**：
  ```
  ┌─────────────────────────────────┐
  │  胡萝卜                        │  ← 食材名 (text-base font-medium)
  │  ┌─────┐                      │
  │  │ 12.5 │  kg  · 根菜类       │  ← 库存量 (text-2xl font-bold) + 单位 + 二级分类 badge
  │  └─────┘                      │
  │  库存充足 │ 2天前更新          │  ← 健康度 badge + 更新时间 (text-xs text-muted-foreground)
  └─────────────────────────────────┘
  ```
  - 卡片样式：`Card` + `p-5` + `hover:shadow-md transition-shadow`
  - 库存量：使用 `text-2xl font-bold text-foreground`
  - 健康度 indicator：左侧一条细竖线（`border-l-4`），颜色映射：
    - 充足 → `border-success`
    - 正常 → `border-warning`
    - 低库存 → `border-destructive`
  - 健康度 badge：复用 `StatusBadge` 组件，新增 `库存状态` 映射（`充足:success, 正常:info, 低库存:warning`）
  - 更新时间：相对于现在的时间差（如"2天前"），使用 `date-fns` 的 `formatDistanceToNow`

#### 3.3.5 列表视图（保留表格作为备选）

用户可通过视图切换按钮从卡片视图切换到列表视图。列表视图沿用现有 Table 但增强：

- 库存量列加粗 + 根据健康度变色（充足 `text-foreground`，低库存 `text-destructive`）
- 新增"库存状态"列（使用 `StatusBadge`）
- 新增"更新时间"列
- 表格行 hover 效果保留
- 分页（如果数据量大）——但库存首页通常品种数不会极端多，可先前端分页（50条/页）

### 3.4 数据结构建议（API 扩展）

当前 API `/api/inventory` 返回扁平数组，新设计需要分类聚合数据。建议：

**方案 A（推荐，最小改动）：前端聚合**
- 复用现有 API，前端按 `l1Name` 和 `l2Name` 分组计算。
- 优点：零后端改动，快速落地。
- 缺点：数据量大时前端计算有压力（但库存数据通常几百条，可接受）。

**方案 B：后端提供聚合端点**
- 新增 `/api/inventory/summary` 返回：
  ```ts
  interface InventorySummary {
    totalItems: number;           // 总品种数
    totalQty: number;             // 总库存量（需统一单位，或只展示数量）
    lowStockCount: number;        // 低库存预警数（需定义阈值规则）
    todayUpdatedCount: number;    // 今日更新数
    categories: CategorySummary[];
  }
  
  interface CategorySummary {
    l1Code: string;
    l1Name: string;
    itemCount: number;            // 该分类品种数
    totalQty: number;             // 该分类总库存量
    l2Groups: {
      l2Code: string;
      l2Name: string;
      itemCount: number;
      totalQty: number;
      items: InventoryItem[];
    }[];
  }
  ```

**建议落地顺序**：先方案 A 前端聚合，验证交互后如需再迁移方案 B。

### 3.5 交互规范

#### 3.5.1 状态流转

```
[加载状态]
  → 骨架屏（KPI 区域 4 个骨架卡片 + 分类区域 6 个骨架胶囊 + 明细区域 6 个骨架卡片）
  → 数据到达后交叉淡入（fade-in）

[分类切换]
  → 点击一级分类胶囊
  → 胶囊激活态切换（高亮 + 边框）
  → 明细区域平滑过渡（无需 loading，数据已在前端缓存）
  → 如果该分类下无数据，明细区域显示 EmptyState（"该分类下暂无库存"）

[搜索]
  → 输入时实时过滤（debounce 300ms）
  → 匹配结果：名称、编码、一级分类名、二级分类名
  → 搜索时自动切换到"全部"分类（或仅显示匹配结果，分类导航高亮"全部"）
  → 搜索为空时显示 EmptyState（"未找到匹配的食材"）

[视图切换]
  → 卡片视图 ↔ 列表视图（toggle button group）
  → 切换时保持当前筛选/搜索状态
```

#### 3.5.2 动画规范

- 使用 `transition-all duration-200 ease-default`（项目已定义 `ease-default: cubic-bezier(0.4, 0, 0.2, 1)`）
- 卡片 hover：`hover:shadow-md hover:-translate-y-0.5`
- 分类切换：明细区域使用 `AnimatePresence` 或简单 CSS transition（shadcn/ui v4 支持 `data-state` 过渡）
- 骨架屏：使用 `Skeleton` 组件（shadcn/ui 已安装）

### 3.6 视觉规范

#### 3.6.1 颜色使用（严格遵循现有 token）

| 元素 | 颜色 token | 说明 |
|------|-----------|------|
| 页面背景 | `bg-background` | 由 next-themes 管理 |
| 卡片背景 | `bg-card` | 现有 token |
| 主要文字 | `text-foreground` | |
| 次要文字 | `text-muted-foreground` | 描述、辅助信息 |
| 激活分类 | `bg-primary text-primary-foreground` | |
| 库存充足指示 | `border-success` | `globals.css` 已定义 `--success` |
| 库存正常指示 | `border-warning` | `globals.css` 已定义 `--warning` |
| 低库存指示 | `border-destructive` | `globals.css` 已定义 `--destructive` |
| 分类 badge（一级） | 使用 CSS 变量映射表 | 见下方 |
| 分类 badge（二级） | `bg-neutral-muted text-neutral` | 或 `bg-muted text-muted-foreground` |

#### 3.6.2 分类颜色映射（建议扩展 globals.css）

在现有 `globals.css` 中已有 `Category tag colors` 区块（第 124-133 行），可直接复用：

```css
--tag-veg: #22c55e; --tag-veg-bg: #f0fdf4;   /* 蔬菜 */
--tag-mea: #ef4444; --tag-mea-bg: #fef2f2;   /* 肉类 */
--tag-aqu: #3b82f6; --tag-aqu-bg: #eff6ff;   /* 水产 */
--tag-pou: #f59e0b; --tag-pou-bg: #fffbeb;   /* 禽类 */
--tag-dry: #f97316; --tag-dry-bg: #fff7ed;   /* 干货 */
--tag-bea: #06b6d4; --tag-bea-bg: #ecfeff;   /* 豆制品 */
--tag-prc: #8b5cf6; --tag-prc-bg: #f5f3ff;   /* 加工品 */
--tag-gra: #64748b; --tag-gra-bg: #f8fafc;   /* 粮油 */
--tag-sea: #ec4899; --tag-sea-bg: #fdf2f8;   /* 调味品/干货 */
```

⚠️ **注意**：这些变量是硬编码十六进制，在暗色模式下可能对比度不足。建议改用 `oklch` 或 `hsl` 的语义化变量定义，并在暗色模式下提供反色版本。但考虑到当前项目已有这些变量，可以先用，后续在暗色模式迭代中统一修复。

#### 3.6.3 字体层级

| 层级 | 样式 | 用途 |
|------|------|------|
| 页面标题 | `text-2xl font-bold tracking-tight` | PageHeader 已定义 |
| 区域标题 | `text-lg font-semibold` | 二级分类标题 |
| 卡片标题 | `text-base font-medium` | 食材名 |
| 大数字 | `text-3xl font-bold` | KPI 数据 |
| 中数字 | `text-2xl font-bold` | 食材库存量 |
| 正文 | `text-sm` | 描述、辅助信息 |
| 微文 | `text-xs` | 更新时间、单位 |

---

## 4. 组件设计

### 4.1 复用现有组件

| 组件 | 来源 | 使用位置 |
|------|------|----------|
| `PageHeader` | `app/components/page-header.tsx` | 页面顶部标题 |
| `StatusBadge` | `app/components/status-badge.tsx` | 库存健康度 badge，需扩展 `库存状态` 映射 |
| `EmptyState` | `app/components/empty-state.tsx` | 无数据/无搜索结果状态 |
| `Card` / `CardContent` / `CardHeader` | `components/ui/card.tsx` | KPI 卡片、食材卡片、分类卡片 |
| `Input` | `components/ui/input.tsx` | 搜索框 |
| `Skeleton` | `components/ui/skeleton.tsx` | 加载骨架屏 |
| `Table` 等 | `components/ui/table.tsx` | 列表视图 |

### 4.2 新增组件建议

| 组件 | 文件 | 职责 | 复杂度 |
|------|------|------|--------|
| `KpiCard` | `app/components/kpi-card.tsx` | 关键指标卡片（图标 + 数字 + 描述） | 低 |
| `CategoryPill` | `app/components/category-pill.tsx` | 一级分类导航胶囊（图标 + 名称 + 数据） | 低 |
| `IngredientCard` | `app/components/ingredient-card.tsx` | 单个食材库存卡片（名称 + 库存量 + 健康度 + 时间） | 中 |
| `ViewToggle` | `app/components/view-toggle.tsx` | 卡片视图/列表视图切换按钮组 | 低 |
| `InventorySkeleton` | `app/components/inventory-skeleton.tsx` | 整个页面的骨架屏组合 | 中 |

---

## 5. 响应式设计

### 5.1 断点策略

使用 Tailwind v4 默认断点：`sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)

| 区域 | 大屏 (≥1024) | 中屏 (768-1024) | 小屏 (<768) |
|------|--------------|-----------------|-------------|
| KPI 卡片 | `grid-cols-4` | `grid-cols-2` | `grid-cols-2` |
| 分类导航 | `grid-cols-6` | `grid-cols-4` + 横向滚动 | `flex-wrap` + 自动换行 |
| 食材卡片 | `grid-cols-3` | `grid-cols-2` | `grid-cols-1` |
| 搜索区 | 与标题同行 | 独立一行 | 独立一行，全宽 |

### 5.2 移动端适配

- 分类导航在小屏下使用 `flex-wrap`，允许换行。
- 搜索框在移动端全宽 (`w-full`)。
- 食材卡片在移动端单列，增大点击区域。
- KPI 卡片在移动端 2x2 网格。

---

## 6. 实现优先级（Roadmap）

### Round 1 — 核心布局重构（P0，必须完成）

1. **数据聚合逻辑**：在 `page.tsx` 中用 `useMemo` 按 `l1Name` 和 `l2Name` 分组数据。
2. **KPI 看板**：新增 `KpiCard` 组件，展示 4 个关键指标。
3. **一级分类导航**：新增 `CategoryPill` 组件，实现横向分类导航。
4. **分类明细区域**：点击分类后展示该分类下食材卡片。
5. **骨架屏加载**：新增 `InventorySkeleton` 组件替换现有 `animate-pulse`。

### Round 2 — 视觉增强（P1，高影响力）

1. **食材卡片设计**：新增 `IngredientCard` 组件，包含健康度指示器、库存量、更新时间。
2. **视图切换**：卡片视图 ↔ 列表视图（保留现有表格）。
3. **搜索增强**：实时搜索 + 自动切换分类。
4. **空状态升级**：EmptyState 增加引导操作（如"去采购"按钮）。
5. **StatusBadge 扩展**：增加 `库存状态` 映射（`充足`、`正常`、`低库存`）。

### Round 3 — 体验打磨（P2，锦上添花）

1. **分类颜色映射**：将现有 `globals.css` 的 `tag-*` 变量映射到一级分类。
2. **动画优化**：分类切换、卡片 hover 的过渡动画。
3. **库存阈值规则**：定义低库存阈值（如 5kg 或根据历史采购数据动态计算）。
4. **暗色模式验证**：检查所有新增元素在 `.dark` 模式下的对比度。
5. **分页**：如果品种数超过 200，增加前端分页或虚拟滚动。

---

## 7. 代码参考结构（伪代码）

```tsx
// app/inventory/page.tsx 新结构
export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("全部");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  // 前端聚合
  const grouped = useMemo(() => {
    const byL1: Record<string, { l1Name: string; items: InventoryItem[] }> = {};
    rows.forEach((r) => {
      const key = r.l1Name || "未分类";
      if (!byL1[key]) byL1[key] = { l1Name: key, items: [] };
      byL1[key].items.push(r);
    });
    return byL1;
  }, [rows]);

  const kpi = useMemo(() => ({
    totalItems: rows.length,
    totalQty: rows.reduce((s, r) => s + r.currentQty, 0),
    lowStockCount: rows.filter((r) => r.currentQty < LOW_STOCK_THRESHOLD).length,
    todayUpdatedCount: rows.filter((r) => isToday(new Date(r.updatedAt))).length,
  }), [rows]);

  // 根据搜索和分类筛选
  const filteredItems = useMemo(() => {
    let items = activeCategory === "全部" ? rows : grouped[activeCategory]?.items || [];
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((r) =>
        r.name.toLowerCase().includes(s) ||
        r.code.toLowerCase().includes(s) ||
        r.l1Name?.toLowerCase().includes(s) ||
        r.l2Name?.toLowerCase().includes(s)
      );
    }
    return items;
  }, [rows, activeCategory, search, grouped]);

  return (
    <div className="flex flex-col gap-6 p-8">
      <PageHeader title="库存管理" description="实时库存查询与管理" showBack />
      
      {/* Tab 切换 */}
      <div className="flex items-center justify-between">
        {/* ... */}
      </div>

      {/* KPI 看板 */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={Tags} title="总品种数" value={kpi.totalItems} />
        <KpiCard icon={Scale} title="总库存量" value={`${kpi.totalQty.toFixed(2)} kg`} />
        <KpiCard icon={AlertTriangle} title="低库存预警" value={kpi.lowStockCount} 
                 highlight={kpi.lowStockCount > 0} />
        <KpiCard icon={Clock} title="今日更新" value={kpi.todayUpdatedCount} />
      </div>

      {/* 搜索 + 视图切换 */}
      <div className="flex items-center gap-3">
        <Input placeholder="搜索食材名称、编码或分类..." ... />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* 分类导航 */}
      <div className="grid grid-cols-6 gap-3">
        {["全部", ...Object.keys(grouped)].map((cat) => (
          <CategoryPill
            key={cat}
            name={cat}
            count={cat === "全部" ? rows.length : grouped[cat].items.length}
            totalQty={...}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
          />
        ))}
      </div>

      {/* 明细区域 */}
      {viewMode === "card" ? (
        <div className="grid grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <IngredientCard key={item.id} item={item} health={getHealth(item)} />
          ))}
        </div>
      ) : (
        <InventoryTable items={filteredItems} />
      )}
    </div>
  );
}
```

---

## 8. 附录：现有审计发现（完整版）

### 8.1 设计系统一致性

| 检查项 | 结果 | 状态 |
|--------|------|------|
| 页面外层布局 `flex flex-col gap-6 p-8` | 全局一致（采购、食材、菜品等页面均使用） | ✅ 通过 |
| PageHeader 复用 | 所有页面使用 `app/components/page-header.tsx` | ✅ 通过 |
| Card 组件 | 使用 shadcn/ui `Card` | ✅ 通过 |
| 表单 Input 高度 | `h-10` 和 `h-9` 混用（SelectTrigger h-10, Input 无高度） | ⚠️ 建议统一 h-10 |
| 按钮清除操作 | 部分页面用原生 `<button>`，部分用 `<Button variant="ghost">` | ⚠️ 建议统一用 shadcn Button |

### 8.2 暗色模式风险

- `globals.css` 中 `--tag-*` 系列变量使用硬编码十六进制（`#22c55e` 等），在 `.dark` 模式下可能对比度过低。
- 建议后续迭代将这些变量纳入暗色模式覆盖，或使用 `hsl` / `oklch` 的暗色兼容值。
- 当前库存页面使用的 `bg-[var(--info-muted)]` 和 `bg-[var(--success-muted)]` 在暗色模式下已适配（因为 `globals.css` 中的语义变量 `--info-muted` 使用 `oklch` 定义）。

### 8.3 组件架构

- `shadcn/ui` 组件库：22 个组件，覆盖基础交互。
- 自定义组件：31 个，集中在 `app/components/`。
- **缺少的共享组件**：`KpiCard`、`CategoryPill`、`IngredientCard`（本次需新增）。
- `StatusBadge` 复用良好，但映射表需扩展。

---

> **文档状态**：设计方案 v1.0  
> **下一步**：按照 Round 1 优先级进入代码实现，或继续细化视觉稿（如需要 HTML 原型评审）。
