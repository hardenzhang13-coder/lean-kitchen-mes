# 精益厨房 V3 — 前端 UI/UX 审计报告

> 审计时间：2026-06-19  
> 审计范围：全部 `app/` 页面、`components/ui/` shadcn 组件、`app/components/` 自定义组件  
> 版本基准：Next.js 16.2.7 / React 19.2.4 / Tailwind CSS v4 / shadcn/ui v4

---

## 1. 执行摘要

### 1.1 整体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 布局一致性 | ⭐⭐⭐⭐☆ | 34 个页面统一使用 `flex flex-col gap-6 p-8` 布局模式，Sidebar 与 PageHeader 已组件化 |
| 组件体系 | ⭐⭐⭐☆☆ | 13 个 shadcn/ui 组件 + 22 个自定义组件，但缺少 EmptyState、StatusBadge、Loading 等标准化组件 |
| 颜色系统 | ⭐⭐☆☆☆ | 50+ 处硬编码 Tailwind 颜色，与主题变量脱节，暗色模式存在严重风险 |
| 字体系统 | ⭐⭐☆☆☆ | 4 种字体变量同时存在，定义混乱，实际使用缺乏层级规范 |
| 表单规范 | ⭐⭐⭐☆☆ | 输入高度不统一（h-9/h-10/h-11），必填标记使用 `text-red-500` 而非 `text-destructive` |
| 交互一致性 | ⭐⭐⭐⭐☆ | Tab/Filter 切换样式统一，按钮操作模式一致，但自定义组件高度与 shadcn 默认冲突 |

### 1.2 关键风险

1. **🔴 暗色模式崩溃**：50+ 处硬编码 `bg-{color}-100 text-{color}-700` 在暗色模式下会显示亮色背景，视觉体验极差
2. **🔴 品牌色不统一**：Sidebar 使用 `indigo` 作为主色调，但系统 primary 是暖橙色（`oklch(0.553 0.195 38.402)`），存在两套品牌色
3. **🟡 表单高度碎片化**：同一个系统内同时存在 h-9、h-10、h-11 三种输入框高度
4. **🟡 破坏性颜色硬编码**：11 处 `text-red-500` 未使用主题变量 `text-destructive`

---

## 2. 技术栈审计

### 2.1 版本兼容性

| 依赖 | 版本 | 状态 | 备注 |
|------|------|------|------|
| next | 16.2.7 | ⚠️ 高危 | 存在大量 breaking changes，部分 API 与旧版不同 |
| react | 19.2.4 | ⚠️ 高危 | 与 Next.js 16 绑定，Hooks 行为可能变化 |
| tailwindcss | 4.x | ✅ 正常 | 使用 `@theme inline` 新语法，无 `tailwind.config.ts` |
| shadcn/ui | v4 | ✅ 正常 | 底层使用 `@base-ui/react` 而非 Radix UI |
| class-variance-authority | 0.7.1 | ✅ 正常 | 用于 shadcn 组件变体 |
| lucide-react | 1.17.0 | ✅ 正常 | 图标库统一，未发现混用其他图标库 |
| next-themes | 0.4.6 | ✅ 正常 | 已集成，暗色模式变量已定义 |

### 2.2 Tailwind CSS v4 配置

- 无 `tailwind.config.ts`，完全使用 CSS 内 `@theme inline` 语法 ✅
- 导入链：`@import "tailwindcss" → @import "tw-animate-css" → @import "shadcn/tailwind.css"` ✅
- 变量定义在 `:root` 和 `.dark` 中，覆盖完整 ✅
- **问题**：`--radius-*` 全部固定为 `0.5rem`，但 Card 组件使用 `rounded-[min(var(--radius-4xl),24px)]`，变量名与实际用途不符

---

## 3. 布局体系审计

### 3.1 页面布局

```
34 个页面统一使用：
<div className="flex flex-col gap-6 p-8">
```

- **状态**：✅ 高度一致
- **覆盖页面**：全部主页面（dashboard, ingredients, purchases, dishes, schedules, inventory, settings 及所有子页面）
- **问题**：部分页面内存在条件分支渲染多个 `<div className="flex flex-col gap-6 p-8">`（如 `schedules/[id]/page.tsx` 3 处重复），应统一为单根容器

### 3.2 Sidebar 导航

```
固定左侧边栏：w-20，图标 + 文字纵向排列
激活态：bg-indigo-50 text-indigo-500  ← 硬编码 indigo
品牌标识：bg-indigo-500 text-white     ← 硬编码 indigo
```

- **状态**：结构一致，但使用 `indigo` 作为品牌色，与主题 primary（暖橙）冲突
- **问题**：用户头像区域的用户名使用 `text-[10px]`，在高分屏上可能难以阅读

### 3.3 PageHeader 组件

```tsx
// 已封装：app/components/page-header.tsx
<PageHeader title="采购管理" description="..." showBack />
```

- **状态**：5+ 页面使用 ✅
- **问题**：部分页面直接手写 `<h1>` + `<p>` 组合，未使用 PageHeader（如 Dashboard、Ingredients 首页）

---

## 4. 颜色系统审计（重点）

### 4.1 硬编码颜色统计

| 颜色模式 | 出现次数 | 典型位置 | 风险等级 |
|----------|----------|----------|----------|
| `bg-{color}-100 text-{color}-700` | ~30 处 | 状态标签、分类标签、Badge 覆盖 | 🔴 高 |
| `text-{color}-500` | ~15 处 | 图标、分类图标 | 🟡 中 |
| `bg-{color}-50` | ~8 处 | 选中态、高亮背景 | 🟡 中 |
| `border-{color}-300` | ~4 处 | 选中态边框 | 🟡 中 |
| `text-red-500` | 11 处 | 必填标记 `*` | 🟡 中 |
| `#007AFF` | 1 处 | 全局 input focus 边框 | 🟡 中 |

### 4.2 具体硬编码分布

**状态标签（状态 → 颜色）**：
```
已结算/已发布 → bg-green-100 text-green-700      (6 处)
待结算/待生效 → bg-amber-100 text-amber-700      (8 处)
草稿/已完成   → bg-gray-100 text-gray-700/600     (5 处)
已作废/删除   → bg-red-100 text-red-700          (3 处)
```

**分类标签（CategoryTag）**：
```
VEG → bg-green-100  text-green-700
MEA → bg-red-100    text-red-700
AQU → bg-blue-100   text-blue-700
POU → bg-amber-100  text-amber-700
DRY → bg-orange-100 text-orange-700
BEA → bg-cyan-100   text-cyan-700
PRC → bg-purple-100 text-purple-700
GRA → bg-slate-100  text-slate-700
SEA → bg-pink-100   text-pink-700
```

**图标颜色**：
```
ingredients/page.tsx:  text-orange-500, text-emerald-500, text-rose-500, text-blue-500, text-purple-500
settings/page.tsx:     text-rose-500, text-emerald-500, text-blue-500, text-amber-500, text-indigo-500
page.tsx:              text-blue-500 (Clock 图标)
```

**选中态/交互态**：
```
border-indigo-300 bg-indigo-50/50     (schedules, purchases)
bg-indigo-50 text-indigo-500          (sidebar 导航)
bg-indigo-500 text-white              (sidebar 品牌)
```

### 4.3 主题变量定义

```css
:root {
  --primary: oklch(0.553 0.195 38.402);        /* 暖橙色 */
  --destructive: oklch(0.577 0.245 27.325);     /* 红色 */
  --sidebar-primary: oklch(0.646 0.222 41.116); /* 暖橙色 */
}
```

- **发现**：Sidebar 的 `indigo` 品牌色与主题 `primary`（暖橙）完全不匹配，系统存在**双品牌色问题**
- **建议**：统一将 Sidebar 品牌色改为 `primary` 或 `sidebar-primary`

---

## 5. 字体系统审计

### 5.1 字体变量定义

```tsx
// app/layout.tsx
const publicSansHeading = Public_Sans({ variable: '--font-heading' });
const dmSans = DM_Sans({ variable: '--font-sans' });
const geistSans = Geist({ variable: '--font-geist-sans' });  // ← 未使用
const geistMono = Geist_Mono({ variable: '--font-geist-mono' }); // ← 仅 mono
```

### 5.2 实际使用

```css
/* globals.css */
--font-sans: var(--font-sans);        /* 实际 → DM_Sans */
--font-mono: var(--font-geist-mono);  /* 实际 → Geist_Mono */
--font-heading: var(--font-heading);  /* 实际 → Public_Sans */
```

```tsx
/* layout.tsx 类名 */
className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", dmSans.variable, publicSansHeading.variable)}
```

### 5.3 问题清单

| 问题 | 位置 | 影响 |
|------|------|------|
| Geist Sans 变量声明但无使用 | `layout.tsx` | 无影响，但冗余 |
| `--font-sans` 变量自引用 | `globals.css` | 实际生效的是 `font-sans` 类名（Tailwind 默认），但 CSS 变量 `--font-sans` 引用了自身，逻辑上应该指向 `var(--font-dm-sans)` |
| `font-heading` 使用不一致 | 全局 | 仅 CardTitle、DialogTitle 使用 `font-heading`，其他标题使用默认字体 |
| 字号缺乏层级规范 | 全局 | 页面标题 `text-2xl`，CardTitle `text-base`，标签 `text-sm`，但混用 `text-xs`、`text-[10px]`、`text-[9px]` |

---

## 6. 组件体系审计

### 6.1 shadcn/ui 组件（13 个）

| 组件 | 文件 | 使用文件数 | 备注 |
|------|------|-----------|------|
| Button | button.tsx | 15+ | 使用 `@base-ui/react/button` 底层，变体体系完整 |
| Card | card.tsx | 12+ | 自定义圆角 `rounded-[min(var(--radius-4xl),24px)]`，与 Button 的 `rounded-2xl` 不一致 |
| Dialog | dialog.tsx | 10+ | 底层使用 `@base-ui/react/dialog`，关闭按钮使用 `bg-secondary` 背景 |
| Input | input.tsx | 8+ | 标准输入框 |
| Label | label.tsx | 6+ | 标准标签 |
| Table | table.tsx | 6+ | 标准表格 |
| Badge | badge.tsx | 5+ | 变体完整，但多处使用 `className` 覆盖为硬编码颜色 |
| Select | select.tsx | 4+ | 标准选择器 |
| Calendar | calendar.tsx | 2 | 依赖 `react-day-picker` |
| Popover | popover.tsx | 2 | 用于 DatePicker |
| Sonner | sonner.tsx | 1 | 全局 Toast，仅 `layout.tsx` 使用 |
| Textarea | textarea.tsx | 1 | 低频使用 |
| Alert | alert.tsx | 0 | **未使用** |

### 6.2 自定义组件（22 个）

| 组件 | 复用 | 职责 | 问题 |
|------|------|------|------|
| PageHeader | 5+ | 页面标题 + 返回按钮 | 部分页面未使用 |
| Pagination | 3+ | 分页控件 | 设计良好 |
| FormField | 2+ | 表单字段（Label + 必填标记 + 子元素） | 内部使用 `text-red-500` |
| FormSection | 2+ | 表单分区（标题 + 网格布局） | 职责清晰 |
| DatePicker | 3+ | 日期选择器 | 高度 h-11，触发器使用 Popover |
| SearchableSelect | 3+ | 搜索下拉选择器 | 使用 Dialog 而非 Popover，移动端友好 |
| SearchableTableSelect | 1 | 带表格的搜索选择器 | 与 SearchableSelect 高度重复，应合并 |
| TileSelect | 1 | 磁贴选择器 | 与 SearchableSelect 结构相似，可抽象为 `SelectDialog` 基础组件 |
| TileGroup | 1 | 磁贴组 | 职责清晰 |
| CategoryTag | 3+ | 分类标签 | 硬编码 10 种颜色，暗色模式不兼容 |
| DishCard | 1 | 菜品卡片 | 状态颜色硬编码 |
| DishCreateWizard | 1 | 菜品创建向导 | 468 行，体积过大，应拆分 |
| IngredientFormDialog | 1 | 食材表单对话框 | 577 行，体积过大，应拆分 |
| IngredientPicker | 1 | 食材选择器 | 高度 h-11，与 SearchableSelect 重复 |
| ProcessTimeline | 1 | 工艺流程时间线 | 按钮高度 h-9，与全局不一致 |
| SchedulePurchaseTable | 1 | 采购排程表 | 职责清晰 |
| ScheduleCuttingTable | 1 | 切配排程表 | 职责清晰 |
| ImportDialog | 1 | 导入对话框 | 内部使用 `text-green-600` 硬编码 |
| ImagePreviewModal | 1 | 图片预览弹窗 | 1 处内联 `style`（transform），合理 |
| SkeletonTable | 2 | 表格骨架屏 | 职责清晰 |
| Sidebar | 1 | 侧边导航 | 品牌色硬编码 indigo |
| SupplierSelect | 1 | 供应商选择器 | 依赖 SearchableSelect |
| UnitSelect | 1 | 单位选择器 | 依赖 SearchableSelect |
| SelectField | 1 | 选择字段 | 职责模糊，使用频率低 |

### 6.3 缺失的标准化组件

| 缺失组件 | 需求 | 当前替代方案 |
|----------|------|-------------|
| **StatusBadge** | 统一状态标签（已结算/待结算/已作废等） | 各页面各自定义 StatusBadge 函数组件（4+ 处重复） |
| **EmptyState** | 空数据状态（图标 + 文案 + 操作按钮） | 各页面直接内联 `<div className="text-center py-16">...` |
| **LoadingState** | 加载状态（骨架屏/Spinner） | 部分使用 SkeletonTable，部分使用 `animate-pulse` 内联 |
| **DataTable** | 统一表格（表头 + 搜索 + 分页 + 操作列） | 各页面直接内联 Table + Pagination |
| **FormLabel** | 统一标签（Label + 必填标记 + 可选标记） | 部分使用 FormField，部分直接手写 `text-red-500` |
| **PageHeader** 扩展 | 带操作按钮的标题栏 | 各页面手动 flex 布局 + Button |

---

## 7. 表单与输入审计

### 7.1 输入框高度不一致

| 高度 | 使用场景 | 出现位置 |
|------|----------|----------|
| `h-9` | 紧凑按钮/小输入 | `ProcessTimeline`（工艺流程按钮） |
| `h-10` | 默认表单输入 | `dish-create-wizard`（部分按钮）、`shadcn/ui/button`（default/sm size） |
| `h-11` | 自定义对话框输入 | `DatePicker`, `SearchableSelect`, `TileSelect`, `IngredientPicker`, `ImportDialog`, `IngredientFormDialog` |

- **标准建议**：统一为 `h-10`（shadcn 默认 default size）或 `h-11`（自定义 dialogs），全系统一致

### 7.2 必填标记混乱

```tsx
// 11 处使用 text-red-500（错误）
<span className="text-red-500">*</span>

// 应改为 text-destructive（正确）
<span className="text-destructive">*</span>
```

**分布位置**：
- `form-field.tsx` × 1
- `dish-create-wizard.tsx` × 3
- `schedules/new/page.tsx` × 2
- `schedules/[id]/edit/page.tsx` × 2
- `purchases/new/page.tsx` × 2
- `purchases/reimbursements/new/page.tsx` × 1

### 7.3 表单封装模式

| 模式 | 使用位置 | 评价 |
|------|----------|------|
| `FormField` 组件 | 2 个页面 | ✅ 封装了 Label + 必填 + 子元素 |
| 直接手写 `<div className="space-y-2">` | 5+ 页面 | 🟡 重复，未统一 |
| 直接手写 Label + Input 无容器 | 2+ 页面 | ❌ 缺少间距和结构 |

---

## 8. 交互模式审计

### 8.1 Tab / Filter 切换

**模式**：统一使用 `bg-muted rounded-lg p-1` 容器 + `bg-background shadow-sm` 激活态

```tsx
<div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
  <button className={cn(
    "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
    active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
  )}>
```

- **状态**：✅ 高度一致，出现在 `purchases/page.tsx`, `schedules/page.tsx`, `inventory/ledger/page.tsx`

### 8.2 表格操作列

**模式**：统一使用 `variant="ghost" size="sm"` + Lucide 图标 + 文字

```tsx
<Button variant="ghost" size="sm">
  <Pencil className="mr-1 h-4 w-4" /> 编辑
</Button>
```

- **状态**：✅ 高度一致

### 8.3 空状态

**模式**：无统一组件，各页面内联实现

```tsx
// 样式 A（purchases/page.tsx）
<div className="text-center text-muted-foreground py-16">
  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
  <p>暂无采购单</p>
  <Button variant="outline" className="mt-4">录入第一单</Button>
</div>

// 样式 B（dishes/page.tsx）
<div className="text-center text-muted-foreground py-16">暂无菜品</div>

// 样式 C（page.tsx）
<Card className="border-dashed">
  <CardContent className="py-8 text-center text-muted-foreground">
    <ChefHat className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
    <p>暂无进行中的排程</p>
  </CardContent>
</Card>
```

- **状态**：❌ 3 种不同空状态样式，应统一为 `EmptyState` 组件

### 8.4 加载状态

```tsx
// 样式 A：SkeletonTable
<SkeletonTable cols={10} rows={10} />

// 样式 B：内联 animate-pulse
<div className="h-40 bg-muted rounded-lg animate-pulse" />

// 样式 C：网格骨架
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {Array.from({ length: 8 }).map((_, i) => (
    <div className="rounded-xl bg-card ring-1 ring-foreground/5 p-5 space-y-3 animate-pulse">
      <div className="h-4 w-24 bg-muted rounded" />
    </div>
  ))}
</div>
```

- **状态**：❌ 3 种不同加载样式，应统一为 `LoadingState` 或 `SkeletonCard` 组件

---

## 9. 暗色模式审计

### 9.1 变量定义

```css
:root { /* 亮色 */ }
.dark { /* 暗色 */ }
```

- **状态**：变量定义完整 ✅，所有语义化颜色（primary, secondary, muted 等）都有暗色对应值

### 9.2 暗色模式风险点

| 问题 | 影响 | 数量 |
|------|------|------|
| `bg-green-100` → 暗色下仍是亮绿色背景 | 状态标签背景在暗色模式下刺眼 | 30+ |
| `text-red-500` → 暗色下对比度可能不足 | 必填标记在暗色背景上不可见 | 11 |
| `#007AFF` focus 边框 → 暗色下过于刺眼 | 输入框聚焦边框 | 1 |
| `text-blue-500` 图标 → 暗色下可能太亮 | 图标颜色 | 15 |
| Sidebar `bg-indigo-50` → 暗色下仍是亮蓝 | 导航激活态背景 | 1 |

### 9.3 建议修复方案

将硬编码颜色替换为语义化变量：

```css
/* 状态标签 → 使用 CSS 自定义属性 */
.status-success { background: var(--success-muted); color: var(--success); }
.status-warning { background: var(--warning-muted); color: var(--warning); }
.status-danger  { background: var(--danger-muted); color: var(--danger); }
.status-neutral { background: var(--neutral-muted); color: var(--neutral); }
```

---

## 10. 发现清单与修复优先级

### 🔴 P0 — 阻断性问题（必须立即修复）

| # | 问题 | 位置 | 修复方案 |
|---|------|------|----------|
| 1 | 暗色模式下硬编码颜色崩溃 | 全局 30+ 处 | 建立语义化状态颜色系统，替换所有 `bg-{color}-100 text-{color}-700` |
| 2 | Sidebar 品牌色与主题 primary 冲突 | sidebar.tsx | 统一为 `primary` 或 `sidebar-primary` 变量 |
| 3 | 必填标记使用 `text-red-500` | 11 处 | 全局替换为 `text-destructive` |

### 🟡 P1 — 高优先级问题（影响一致性与可维护性）

| # | 问题 | 位置 | 修复方案 |
|---|------|------|----------|
| 4 | 输入框高度碎片化（h-9/h-10/h-11） | 全局 | 统一为 `h-10`（默认）或 `h-11`（大尺寸对话框），制定高度规范 |
| 5 | 空状态样式不统一 | 3 种样式 | 创建 `EmptyState` 组件，统一使用 |
| 6 | 加载状态样式不统一 | 3 种样式 | 创建 `LoadingState` / `SkeletonCard` 组件 |
| 7 | 状态标签重复定义 | 4+ 页面各自定义 | 创建 `StatusBadge` 组件，统一状态映射 |
| 8 | 表单字段封装不一致 | 部分使用 FormField，部分手写 | 推广 `FormField` + 新建 `FormLabel` 组件 |
| 9 | 搜索选择器组件重复 | SearchableSelect / SearchableTableSelect / TileSelect | 抽象为 `SelectDialog` 基础组件，3 个变体复用 |
| 10 | 大文件组件拆分 | dish-create-wizard (468行), ingredient-form-dialog (577行) | 按步骤/步骤拆分为子组件 |

### 🟢 P2 — 中优先级问题（优化体验）

| # | 问题 | 位置 | 修复方案 |
|---|------|------|----------|
| 11 | 字体变量冗余 | layout.tsx | 移除未使用的 `geistSans.variable`，简化字体配置 |
| 12 | 字体层级缺失 | 全局 | 建立规范：页面标题 `text-2xl font-heading`，卡片标题 `text-base font-semibold`，正文 `text-sm` |
| 13 | 全局 focus 颜色硬编码 | globals.css | 将 `#007AFF` 替换为 `var(--ring)` 或 `var(--primary)` |
| 14 | Card 与 Button 圆角不一致 | card.tsx vs button.tsx | 统一圆角变量或明确区分层级 |
| 15 | 未使用的 shadcn Alert 组件 | alert.tsx | 确认是否需要保留，或用于全局错误提示 |
| 16 | 页面内重复布局容器 | schedules/[id]/page.tsx | 条件分支应使用单根容器，避免重复 `flex flex-col gap-6 p-8` |
| 17 | CategoryTag 颜色暗色适配 | category-tag.tsx | 使用语义化颜色变量替代硬编码 Tailwind 颜色 |

---

## 11. 标准化建议与路线图

### 11.1 短期目标（1-2 轮迭代）

**第 1 轮：颜色系统标准化**
1. 在 `globals.css` 定义语义化状态颜色变量（成功/警告/危险/中立）
2. 创建 `StatusBadge` 组件，统一替换所有页面内的状态标签
3. 替换 `text-red-500` → `text-destructive`（全局 11 处）
4. 替换 Sidebar 的 `indigo` → `primary` 变量
5. 修复 `#007AFF` focus 颜色

**第 2 轮：组件标准化**
1. 创建 `EmptyState` 组件（图标 + 文案 + 可选操作按钮）
2. 创建 `LoadingState` 组件（表格/卡片/页面骨架屏）
3. 统一输入框高度：所有自定义组件使用 `h-10`
4. 抽象 `SelectDialog` 基础组件，合并 SearchableSelect/SearchableTableSelect/TileSelect 的公共结构

### 11.2 中期目标（2-4 轮迭代）

1. 拆分大文件组件：`DishCreateWizard` 拆分为 Step 子组件，`IngredientFormDialog` 拆分为 Tab 子组件
2. 创建 `DataTable` 封装组件（Table + 搜索 + 分页 + 操作列）
3. 建立字体层级规范文档，统一页面标题/卡片标题/正文/标签的字号与字重
4. 暗色模式全面测试与修复

### 11.3 长期目标

1. 建立设计系统文档（Design System Doc）
2. 引入 Storybook 或类似工具进行组件可视化文档
3. 建立视觉回归测试（Visual Regression Testing）
4. 考虑暗色模式的自动测试覆盖

---

## 附录：硬编码颜色完整清单

```
// 状态标签（Badge/span 覆盖）
app/page.tsx:111        → bg-green-100 text-green-700
app/dishes/[id]/page.tsx:391-394 → bg-green-100, bg-gray-100, bg-amber-100
app/inventory/page.tsx:170        → bg-blue-50 text-blue-700
app/inventory/page.tsx:179        → bg-emerald-50 text-emerald-700
app/purchases/reimbursements/[id]/page.tsx:129-130 → bg-green-100, bg-amber-100
app/purchases/reimbursements/page.tsx:149-150      → bg-green-100, bg-amber-100
app/purchases/page.tsx:80-93     → bg-green-100, bg-red-100, bg-amber-100
app/inventory/ledger/page.tsx:228-322 → bg-green-100, bg-red-100, bg-blue-100, bg-gray-100
app/schedules/page.tsx:33-35     → bg-amber-100, bg-green-100, bg-gray-100
app/schedules/[id]/page.tsx:58-60 → bg-amber-100, bg-green-100, bg-gray-100
app/schedules/[id]/page.tsx:222  → bg-amber-50 border-amber-200 text-amber-700
app/components/dish-card.tsx:33-35 → bg-green-100, bg-gray-100, bg-amber-100
app/components/category-tag.tsx:6-15 → 10 种颜色硬编码
app/purchases/new/page.tsx:1075 → bg-red-50/50
app/purchases/new/page.tsx:1110-1114 → bg-red-100, bg-green-100
app/purchases/reimbursements/new/page.tsx:191 → border-indigo-300 bg-indigo-50/50
app/schedules/[id]/edit/page.tsx:293 → border-indigo-300 bg-indigo-50/50 ring-indigo-200
app/schedules/new/page.tsx:303 → border-indigo-300 bg-indigo-50/50 ring-indigo-200
app/schedules/[id]/page.tsx:222 → bg-amber-50 border-amber-200 text-amber-700

// 图标颜色
ingredients/page.tsx:13,21,29,37,45 → text-orange-500, text-emerald-500, text-rose-500, text-blue-500, text-purple-500
settings/page.tsx:13,20,27,34,43 → text-rose-500, text-emerald-500, text-blue-500, text-amber-500, text-indigo-500
page.tsx:67 → text-blue-500
app/purchases/reimbursements/new/page.tsx:196 → text-indigo-500
app/schedules/[id]/edit/page.tsx:299 → text-indigo-500
app/schedules/new/page.tsx:310 → text-indigo-500
app/dishes/[id]/page.tsx:489 → text-green-600
app/import-dialog.tsx:179,227 → text-green-600
app/dish-card.tsx:87 → text-green-600 bg-green-50

// Sidebar 品牌色
app/components/sidebar.tsx:37 → bg-indigo-500 text-white
app/components/sidebar.tsx:56 → bg-indigo-50 text-indigo-500

// 必填标记
全局 11 处 text-red-500

// Focus 颜色
globals.css:139-140 → border-color: #007AFF; box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.06)
```
