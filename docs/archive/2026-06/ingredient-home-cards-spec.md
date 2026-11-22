# 食材首页数据指标型卡片重构需求文档

> **需求来源**：基于 `frontend-redesign`（UI/UX Pro Max）Skill 规范，将现有食材库入口卡片从「简单描述型」重构为「数据指标型」。
> **文档用途**：可直接交付 Coding 工程师执行，无需额外沟通。
> **版本**：v1.0 | 2026-06-21

---

## 一、需求概述

### 1.1 目标
将 `app/ingredients/page.tsx` 现有的 5 个入口卡片从「图标+标题+描述」的静态导航卡片，升级为「数据指标驱动」的运营概览卡片，让运营人员（食材数据管理角色）一眼掌握每类食材的规模、增长和活跃度。

### 1.2 现状问题
- 现有卡片使用硬编码 Tailwind 颜色（`text-orange-500`、`text-emerald-500` 等），**暗色模式不兼容**（P0 级）
- 卡片仅展示静态描述，没有实际数据价值
- 3 列网格下 5 个卡片排列为 2+1+2，视觉不整齐
- 缺少加载状态、空状态、错误状态的处理

### 1.3 设计约束
- 遵循「不做无意义统计报表」原则（Product.md），只展示与食材管理直接相关的**基础运营指标**
- 所有颜色必须使用项目设计令牌（CSS 变量），**禁止新增任何硬编码颜色**
- 遵循 shadcn/ui v4 + Tailwind CSS v4 + Next.js 16 规范

---

## 二、数据指标定义（5 张卡片）

每张卡片包含 **1 个主指标 + 2 个次指标**，指标定义如下：

| 卡片 | 主指标 | 次指标 1 | 次指标 2 | 主题语义色 |
|------|--------|---------|---------|----------|
| **原料清单** | 当前总数（种） | 本月新增（+N） | 被 N 道菜品使用 | `--status-primary`（橙） |
| **净料清单** | 当前总数（种） | 本月新增（+N） | 关联 N 种原料 | `--status-success`（绿） |
| **小料清单** | 当前总数（种） | 本月新增（+N） | — | `--status-danger`（玫红） |
| **调料清单** | 当前总数（种） | 本月新增（+N） | — | `--status-info`（蓝） |
| **酱料清单** | 当前总数（种） | 本月新增（+N） | — | `--tag-prc`（紫） |

**指标说明**：
- **当前总数**：该类别食材表中的记录总数（`COUNT(*)`）
- **本月新增**：`created_at >= DATE_TRUNC('month', CURRENT_DATE)` 的记录数
- **被 N 道菜品使用**：该类别食材被多少道不同的菜品配方引用（`dish_net_details` / `dish_seasoning_details` / `dish_sauce_details` 中的唯一 `dish_id` 数）
- **关联 N 种原料**：净料表中 `source_ingredient_id` 去重后的数量

**为什么是这些指标**：
- 对运营人员而言，"食材有多少条、这个月新增了多少、有没有被菜品使用"是最基础的判断依据
- 原料和净料关联菜品/原料，有第三个指标；小料、调料、酱料当前不走精确库存管理，只展示 2 个指标

---

## 三、UI 设计规范

### 3.1 布局系统

```
┌────────────────────────────────────────────────────┐
│ 食材库                                              │  ← 页面标题（text-2xl font-bold）
│ 管理五类食材档案，实时监控数据规模                    │  ← 副标题（text-muted-foreground）
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │  ← 5 张卡片
│  │ 原料    │ │ 净料    │ │ 小料    │ │ 调料    │ │ 酱料    │  │     一行 5 列
│  │ 259 种  │ │  42 种  │ │  18 种  │ │  35 种  │ │  12 种  │  │
│  │ +5 本月 │ │ +2 本月 │ │ +1 本月 │ │ +3 本月 │ │ 0 本月  │  │
│  │ 86 道菜 │ │ 31 原料 │ │         │ │         │ │         │  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

**网格规则**：
- `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5`
- 大屏（≥1024px）：5 列一排，等宽
- 中屏（≥640px）：2 列
- 小屏（<640px）：1 列

**外框规则**：
- 页面外层：保持现有 `flex flex-col gap-6 p-8`
- 卡片与标题之间间距：`gap-6`

### 3.2 卡片内部结构（从上到下）

```
┌──────────────────────────┐
│ [ICON] 原料清单          │  ← 第一行：图标 + 标题
│      ↑text-sm font-medium│
├──────────────────────────┤
│ 259                      │  ← 第二行：主指标（大数字）
│ 种                       │
├──────────────────────────┤
│ +5  │  86 道菜  │ 本月新增 │  ← 第三行：次指标（横向排列）
│ 本月│  被使用   │         │
├──────────────────────────┤
│ 食材采购入库、库存管理     │  ← 第四行：描述（可选精简）
│ 的基本单位               │
└──────────────────────────┘
```

**各区域样式**：

| 区域 | 元素 | 样式 |
|------|------|------|
| **第一行** | 图标 | 尺寸 `w-5 h-5`，使用语义色变量填充 |
| | 标题 | `text-sm font-medium text-foreground` |
| **第二行** | 主数字 | `text-3xl font-bold tracking-tight text-foreground` |
| | 单位后缀 | `text-sm font-medium text-muted-foreground` |
| **第三行** | 次指标 | `flex gap-3` 横向排列，每项 `text-xs text-muted-foreground` |
| | 高亮数字 | 使用语义色变量（如 `color: var(--status-primary)`） |
| **第四行** | 描述 | `text-xs text-muted-foreground` 可精简或省略 |

### 3.3 颜色系统（核心）

**禁止项**：
- ❌ `text-orange-500`、`text-emerald-500`、`text-blue-500` 等任何硬编码 Tailwind 颜色类
- ❌ `bg-orange-500`、`bg-blue-500` 等任何硬编码背景色
- ❌ Hex 或 RGB 直接写死在 className 中

**正确做法**：使用项目已定义的 CSS 语义变量，通过 **style prop** 或 **CSS 变量映射** 应用颜色：

| 卡片 | 语义变量名 | 亮色值 | 暗色自适应 |
|------|-----------|--------|-----------|
| 原料 | `--status-primary` | `#ea580c`（橙） | 通过 `oklch` 根变量自动适配 |
| 净料 | `--status-success` | `#22c55e`（绿） | 同上 |
| 小料 | `--status-danger` | `#ef4444`（玫红） | 同上 |
| 调料 | `--status-info` | `#3b82f6`（蓝） | 同上 |
| 酱料 | `--tag-prc` | `#8b5cf6`（紫） | 同上 |

**图标颜色应用方式**：

```tsx
// 每张卡片定义主题色变量
const themeColor = "var(--status-primary)"; // 原料
// 渲染时：
<Icon style={{ color: themeColor }} className="w-5 h-5" />
// 高亮数字：
<span style={{ color: themeColor }}>+5</span>
```

**卡片整体色调**：
- 卡片背景：默认 `bg-card`（shadcn 变量），不覆盖
- 卡片 hover：`hover:shadow-md hover:ring-1 hover:ring-primary/10 transition-all duration-200`
- 暗色模式：所有颜色通过 CSS 变量自动适配，无需额外写 `.dark` 覆盖

### 3.4 字体系统

- 主数字：`text-3xl font-bold tracking-tight`，使用 `font-sans`（DM Sans）
- 标题：`text-sm font-medium`
- 次指标：`text-xs text-muted-foreground`
- 高亮数字：保持 `text-xs` 但改变颜色（不放大，避免喧宾夺主）

### 3.5 圆角与阴影

- 卡片圆角：`rounded-2xl`（shadcn v4 标准）
- 默认阴影：无（或 `shadow-sm`）
- hover 阴影：`shadow-md`
- 卡片内边距：`p-5`（上下左右统一）

---

## 四、交互规范

### 4.1 点击行为
- 卡片整体可点击 → 导航到对应列表页（`/ingredients/raw` 等）
- 使用 `<Link>` 包裹，保持 SPA 导航体验
- 鼠标悬停：卡片整体上浮感（`hover:shadow-md hover:ring-1 hover:ring-primary/10`）
- 过渡动画：`transition-all duration-200`

### 4.2 加载状态
- 数据加载时显示骨架屏（`animate-pulse`）
- 骨架屏结构：灰色圆块（图标）+ 灰色条（标题）+ 灰色大条（数字）+ 灰色小条（次指标）

### 4.3 空状态与错误状态
- 空状态（总数为 0）：主数字显示 `0`，次指标显示 `-`，不隐藏卡片
- 错误状态：请求失败时显示 `--` 代替数字，hover 提示「数据加载失败，点击重试」

---

## 五、API 数据需求

### 5.1 后端接口

**新增 API**：`GET /api/ingredients/stats`

返回示例：
```json
{
  "code": 0,
  "data": {
    "raw": { "total": 259, "newThisMonth": 5, "usedInDishes": 86 },
    "net": { "total": 42, "newThisMonth": 2, "linkedToRaw": 31 },
    "minor": { "total": 18, "newThisMonth": 1 },
    "seasoning": { "total": 35, "newThisMonth": 3 },
    "sauce": { "total": 12, "newThisMonth": 0 }
  }
}
```

**字段说明**：
- `total`：COUNT(*)
- `newThisMonth`：created_at >= 本月 1 号的 COUNT
- `usedInDishes`：原料/净料被多少道不同菜品使用（去重 dish_id）
- `linkedToRaw`：净料关联多少种不同原料（去重 source_ingredient_id）

### 5.2 前端调用
- 页面组件保持 `"use client"`
- 使用 `useEffect` + `fetch` 获取数据
- 加载状态用 `isLoading` 控制骨架屏显示
- 错误时 Toast 提示（`sonner`）并显示占位符

---

## 六、组件拆分建议

为了保持代码整洁，建议拆分：

```
app/ingredients/
├── page.tsx              ← 页面壳，请求数据，布局
├── components/
│   ├── ingredient-stat-card.tsx   ← 单张指标卡片（接收数据 + 主题配置）
│   └── ingredient-card-skeleton.tsx  ← 骨架屏
```

`ingredient-stat-card.tsx` 的 props 接口：
```tsx
interface IngredientStatCardProps {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  themeColor: string;       // CSS 变量名，如 "var(--status-primary)"
  total: number;
  newThisMonth: number;
  extraLabel?: string;      // 第三个指标的标签，如 "被 N 道菜使用"
  extraValue?: number;
  isLoading?: boolean;
}
```

---

## 七、实现检查清单（必须全部通过）

- [ ] 输入校验：接口返回数据校验（zod 或手动）
- [ ] 操作日志：数据请求本身不修改数据，不需要 logOperation
- [ ] 错误处理：返回 `{ code, data?, message? }` 格式，前端有错误 fallback
- [ ] 类型安全：无 `any`
- [ ] 分页：非列表 API，不涉及
- [ ] 权限检查：不需要（食材库为公开数据）
- [ ] 暗色模式：所有颜色通过 CSS 变量，无硬编码，暗色自动适配
- [ ] 响应式：5 列 → 2 列 → 1 列，所有断点正常
- [ ] 可访问性：卡片有语义化 role="link" 或 Link 组件正确包裹

---

## 八、新 API 必选清单

### 8.1 `GET /api/ingredients/stats`

- [ ] **输入校验**：无 query 参数，无需校验
- [ ] **操作日志**：不需要（只读接口）
- [ ] **错误处理**：数据库查询失败返回 `{ code: 500, message: "获取食材统计失败" }`
- [ ] **类型安全**：返回类型定义在 `lib/types.ts`（或同类文件），禁止 `any`
- [ ] **分页**：不涉及
- [ ] **权限检查**：不需要

---

## 九、现有代码修改范围

### 修改文件：
1. `app/ingredients/page.tsx` — 重写页面逻辑，引入数据请求 + 卡片组件
2. `app/ingredients/components/ingredient-stat-card.tsx` — 新建单卡片组件
3. `app/ingredients/components/ingredient-card-skeleton.tsx` — 新建骨架屏
4. `app/api/ingredients/stats/route.ts` — 新建统计 API

### 不修改文件：
- `components/ui/card.tsx` — 继续使用 shadcn Card
- `app/globals.css` — 颜色已足够，不新增 CSS 变量
- `app/layout.tsx` — 布局不变

---

## 十、视觉参考（文字描述）

**理想效果**：类似 Stripe Dashboard 或 Vercel Dashboard 的指标卡片——简洁、数据为先、颜色克制但可区分。

- 卡片纯白背景（`bg-card`），无边框或极淡边框（`border-border/40`）
- 主数字是页面最显眼的元素，引导视线
- 次指标用 muted 色压暗，只在需要时吸引注意
- 图标和主数字形成左侧隐形轴线，整体左对齐
- 悬停时卡片微微抬升，有明确的可点击暗示

---

*文档结束。本方案已考虑 Product.md 约束、Database.md 数据模型、frontend-redesign 颜色规范。可直接进入 Plan 模式执行。*
