# 精益厨房 V3 — 设计规范

> 页面布局及侧边栏为自定制项。UI 组件体系基于 **shadcn/ui v4 + Tailwind CSS v4**，全局颜色/圆角/高度/字体/微交互动画已标准化。组件层使用自建通用组件（DataTable/FormField/EmptyState/LoadingState/SelectDialog 等）。
>
> 版本：v2.0 | 2026.06.19

---

## 一、页面布局

```
┌──────────┐  ┌─────────────────────────────────────────┐
│  ⚙️      │  │  Header: 标题 + 操作按钮                 │
│  精益厨房  │  │                                         │
│          │  │  ┌──────┐ ┌──────┐ ┌──────┐              │
│  ⊞ 工作台 │  │  │统计卡│ │统计卡│ │统计卡│              │
│  📋 排程  │  │  └──────┘ └──────┘ └──────┘              │
│  🛒 采购  │  │                                         │
│  📦 库存  │  │  ┌─────────────────────────────────┐    │
│  🍽️ 菜品  │  │  │ 列表/表格 (DataTable)            │    │
│  🥬 食材  │  │  └─────────────────────────────────┘    │
│  ⚙️ 设置  │  │                                         │
│          │  │                                         │
│  👤 退出  │  │                                         │
└──────────┘  └─────────────────────────────────────────┘
    fixed          flex-1 flex-col ml-20
   w-20 h-full     px-8 py-6 gap-6
   左侧固定         max-w-[1440px] mx-auto
```

- 侧边栏 `fixed left-0 top-0 h-full w-20`，不参与文档流
- 内容区 `flex-1 flex-col ml-20 px-8 py-6 gap-6`

---

## 二、侧边栏

唯一自定制组件。`w-20` 紧凑图标式，7 个导航项竖向平铺，无分组。

### 品牌区

| 项 | 规范 |
|----|------|
| 图标 | `Sliders` (Lucide)，h-6 w-6 |
| 容器 | h-10 w-10，rounded-md (6px)，bg-primary |
| 文字 | "精益厨房" text-[10px] font-medium text-muted-foreground tracking-tight |
| hover | brightness-105，过渡 150ms |

### 导航项

| 状态 | 样式 |
|------|------|
| nav-btn 默认 | `flex flex-col items-center justify-center w-16 h-16 rounded-md gap-1 text-muted-foreground hover:bg-muted hover:text-foreground` |
| nav-btn 激活 | `bg-primary/10 text-primary` + 左侧 indicator 竖条 (`w-1 h-6 rounded-full bg-primary absolute left-1`) |
| 过渡 | 150ms ease-out |

### 用户区

| 项 | 规范 |
|----|------|
| 头像 | h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm |
| 内容 | 拼音首字母大写（如 "Z"），无姓名时显示 User 图标 |
| 用户名 | text-xs font-medium text-foreground truncate |
| 角色标签 | 胶囊 Badge：bg-primary/10 text-primary rounded-full text-[10px] px-1.5 h-4 |
| 退出按钮 | "退出"（非"登出"），text-xs text-muted-foreground hover:text-foreground |
| 用户区域悬浮 | **无交互**，无 hover:bg-muted |

---

## 三、颜色系统

### 主题变量（:root 亮色唯一，无暗色模式）

```css
--primary: oklch(0.553 0.195 38.402);          /* 暖橙色 */
--primary-foreground: oklch(0.98 0.016 73.684);
--destructive: oklch(0.577 0.245 27.325);      /* 红色 */
--background: oklch(1 0 0);                     /* 白色 */
--foreground: oklch(0.145 0 0);                /* 近黑 */
```

### 语义化状态颜色

| 状态 | 背景 | 文字 | 使用场景 |
|------|------|------|----------|
| success | var(--status-success-bg) = #f0fdf4 | var(--status-success) = #22c55e | 已结算、已发布、进行中 |
| warning | var(--status-warning-bg) = #fffbeb | var(--status-warning) = #f59e0b | 待结算、待生效 |
| danger | var(--status-danger-bg) = #fef2f2 | var(--status-danger) = #ef4444 | 已作废、删除、必填错误 |
| neutral | var(--status-neutral-bg) = #f9fafb | var(--status-neutral) = #6b7280 | 草稿、已完成 |
| info | var(--status-info-bg) = #eff6ff | var(--status-info) = #3b82f6 | 原料、AI 来源 |

### 分类标签颜色（CategoryTag）

| 分类 | 背景 | 文字 |
|------|------|------|
| 蔬菜 VEG | #f0fdf4 | #22c55e |
| 畜肉 MEA | #fef2f2 | #ef4444 |
| 水产 AQU | #eff6ff | #3b82f6 |
| 禽蛋 POU | #fffbeb | #f59e0b |
| 干货 DRY | #fff7ed | #f97316 |
| 豆制品 BEA | #ecfeff | #06b6d4 |
| 加工制品 PRC | #f5f3ff | #8b5cf6 |
| 谷物 GRA | #f8fafc | #64748b |
| 海鲜 SEA | #fdf2f8 | #ec4899 |

> 所有状态/分类颜色均通过 CSS 变量定义，**禁止硬编码 Tailwind 颜色类**（如 `bg-green-100 text-green-700`）。

---

## 四、字体系统

| 层级 | 字体 | 字号 | 字重 | 用途 |
|------|------|------|------|------|
| 页面标题 | DM Sans (heading) | text-2xl | font-bold | PageHeader title |
| 区块标题 | DM Sans | text-lg | font-semibold | Card 区块标题、Tab 标题 |
| 卡片标题 | DM Sans (heading) | text-base | font-semibold | CardTitle、DialogTitle |
| 正文 | DM Sans | text-sm | font-normal | 表格内容、描述文字 |
| 标签/辅助 | DM Sans | text-xs | font-medium | Badge、Tag、表格头 |
| 导航标签 | DM Sans | text-xs | font-bold | Sidebar 导航文字 |
| 徽标文字 | DM Sans | text-[10px] | font-medium | 用户名、角色徽标 |

- 字体族：`DM Sans`（body + heading），`Geist_Mono`（mono）
- 全局启用 `antialiased`

---

## 五、圆角系统

| 层级 | 圆角 | Tailwind | 组件 |
|------|------|----------|------|
| 容器级 | 6px | rounded-lg | Card、Dialog、Popover |
| 控件级 | 4px | rounded-md | Button、Input、Select、Textarea |
| 导航项 | 4px | rounded-md | Sidebar NavItem |
| 标签/胶囊 | 9999px | rounded-full | Badge、Tag、角色标签 |
| 头像 | 9999px | rounded-full | 用户头像 |

---

## 六、高度系统

| 元素 | 高度 | 备注 |
|------|------|------|
| Input / Select Trigger | h-11 (44px) | 表单统一 |
| Button (default) | h-11 (44px) | 表单/操作按钮 |
| Button (sm) | h-9 (36px) | 表格操作列、分页按钮 |
| Button (icon) | h-10 (40px) | 方形图标按钮 |
| DatePicker Trigger | h-11 | 与 Input 对齐 |
| SearchableSelect Trigger | h-11 | 与 Input 对齐 |
| Sidebar NavItem | h-16 w-16 | 大图标区域，保持 |
| Table Header | h-10 (40px) | 表头紧凑 |
| Table Row (中等) | ~48-52px | TableCell py-3 px-2 |

---

## 七、微交互动画系统

全局动画基础变量：
```css
--transition-fast: 0.15s;
--transition-normal: 0.2s;
--transition-slow: 0.3s;
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
```

### 交互元素动画规范

| 元素 | 状态 | 效果 | 时长 | 缓动 |
|------|------|------|------|------|
| Button | hover | brightness-105 | 150ms | ease-out |
| Button | active | scale-[0.98] | 50ms | ease-out |
| Button | disabled | opacity-50 | 150ms | ease-out |
| Input/Select/Textarea | focus | ring-2 ring-primary/15 + border-primary | 150ms | ease-out |
| Input/Select/Textarea | hover | border-foreground/20 | 150ms | ease-out |
| Input/Select/Textarea | error | border-destructive + ring-destructive/15 | 150ms | ease-out |
| Card | hover | shadow-sm + translate-y-[-1px] | 200ms | ease-out |
| Table Row | hover | bg-muted/50 | 150ms | ease-out |
| Sidebar NavItem | active | 左侧 indicator + bg-primary/10 + text-primary | 150ms | ease-out |
| Sidebar NavItem | hover | bg-muted + text-foreground | 150ms | ease-out |
| Badge/Tag | hover | brightness-105 | 150ms | ease-out |
| Dialog/Popover | 打开/关闭 | 保持 shadcn animate-in/out | 已有 | 已有 |
| Toast | 出现/消失 | 保持 sonner 默认 | 已有 | 已有 |
| Link | hover | underline-offset-2 | 150ms | ease-out |

---

## 八、组件体系

### 8.1 shadcn/ui 基础组件（13个）

Button、Card、Dialog、Input、Label、Table、Badge、Select、Calendar、Popover、Sonner、Textarea、Alert

> 所有 shadcn/ui 组件通过 CLI 管理，**禁止手动修改**底层代码。仅通过 `className` 扩展。

### 8.2 自建通用组件

| 组件 | 职责 | 使用范围 |
|------|------|----------|
| **PageHeader** | 页面标题 + 返回按钮 | 所有页面 |
| **EmptyState** | 空数据状态（图标+文案+操作） | 所有列表页 |
| **LoadingState** | 加载状态（table/card-grid/page/inline） | 所有列表页 |
| **StatusBadge** | 统一状态标签（success/warning/danger/neutral/info） | 所有状态显示 |
| **FormField** | 标签 + 必填标记 + 错误提示 + 子元素 | 所有表单 |
| **FormSection** | 表单分组（标题 + 网格布局 1/2/3/4列） | 复杂表单 |
| **FormInput** | 统一 Input 封装（h-11 + rounded-md + focus动画 + error态） | 所有表单 |
| **FormSelect** | 统一 Select 封装（h-11 + 错误态） | 所有表单 |
| **FormError** | 字段级错误提示（图标 + 文字 + 过渡动画） | 表单校验 |
| **FormActions** | 底部操作栏（取消 + 保存，h-11，loading状态） | 所有表单 |
| **DataTable** | 统一表格（数据+列定义+分页+搜索+空状态+加载态+操作列） | 所有列表页 |
| **RowActions** | 操作列（纯图标按钮 + Tooltip + 确认弹窗） | 表格行右侧 |
| **Pagination** | 分页（首页 + 上一页 + 页码 + 下一页 + 尾页） | 表格底部 |
| **SelectDialog** | 选择器外壳（触发器 + Dialog + 搜索 + 底部取消） | 选择器基础 |
| **SelectListMode** | 列表选择器（搜索+单选） | 供应商/单位选择 |
| **SelectTableMode** | 表格选择器（多列信息+分页） | 食材搜索 |
| **SelectTileMode** | 磁贴选择器（网格+可选描述） | 分类/单位/季节选择 |
| **CategoryTag** | 分类标签（10种颜色，CSS变量） | 食材分类显示 |
| **DatePicker** | 日期选择器（Popover + Calendar） | 表单日期字段 |

### 8.3 表单校验体系

| 校验层级 | 时机 | 展示方式 |
|----------|------|----------|
| 实时校验（blur） | 用户离开输入框时 | FormError 字段级提示 |
| 输入中（onChange） | 用户输入时 | 已有错误时实时清除，不新增 |
| 提交校验 | 点击保存时 | 全量校验 + 滚动到第一个错误字段 |
| 服务端校验 | API 返回 400/422 时 | 字段级错误回填到对应字段 + Toast |

### 8.4 布局规范

- 页面根容器：`flex flex-col gap-6 p-8`
- 表单布局：
  - 简单表单（≤5字段）：1列，gap-5
  - 中等表单（6-10字段）：2列，1-2个FormSection，分组内gap-5，分组间gap-6
  - 复杂表单（10+字段）：2列，3+个FormSection
- 弹窗表单：1列，gap-4

---

## 九、图标

导航图标统一使用 **Lucide Icons**（shadcn/ui 默认集成）。

| 位置 | 图标 |
|------|------|
| 工作台 | LayoutDashboard |
| 排程 | CalendarDays |
| 采购 | ShoppingCart |
| 库存 | Package |
| 菜品 | UtensilsCrossed |
| 食材 | Carrot |
| 设置 | Settings |
| 退出 | LogOut |
| 系统Logo | Sliders |

---

*版本：v2.0 | 2026.06.19 | 更新：颜色系统标准化、语义化状态颜色、字体简化、圆角降级、高度统一、微交互动画系统、组件体系文档化*

