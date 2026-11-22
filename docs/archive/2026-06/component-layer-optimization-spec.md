# 精益厨房 V3 — 组件层优化需求文档

> 本文档作为 Claude Code 的完整执行需求输入，涵盖组件层优化、选择器重构、表单拆分及全局修正。代码层面的设计与执行由 CC 的 plan 模式自主完成。
>
> 当前系统版本：Next.js 16.2.7 / React 19.2.4 / Tailwind CSS v4 / shadcn/ui v4
> 前置依赖：全局标准化（颜色/圆角/高度/字体/表格/分页/图标）已验收通过
> 排除范围：排程模块、库存模块、菜品模块不参与本次优化

---

## 一、全局修正（Sidebar 区域）

> 基于补充指令的修正项，纳入组件层优化统一执行。

### 1.1 Logo 图标化

| 项 | 当前 | 目标 |
|----|------|------|
| 内容 | "精" 字 | `Sliders` 图标（Lucide，代表精益/优化） |
| 尺寸 | `h-8 w-8` | `h-10 w-10`（40px） |
| 背景 | `bg-primary` | `bg-primary`（保持） |
| 文字 | `text-xs font-bold` | 图标 `h-6 w-6` |
| 圆角 | `rounded-lg` | `rounded-md`（6px，与全局降级一致） |
| 下方文字 | "精益厨房" `text-xs` | "精益厨房" `text-[10px] font-medium text-muted-foreground tracking-tight` |
| hover | 无 | `brightness-105`，过渡 150ms |

**涉及文件**：`app/components/sidebar.tsx` 第 35-40 行

**图标导入**：`import { Sliders } from "lucide-react"`

---

### 1.2 用户区域：悬浮无交互

| 项 | 当前 | 目标 |
|----|------|------|
| 容器样式 | `group rounded-md py-1.5 transition-colors hover:bg-muted` | 去掉 `group`、去掉 `hover:bg-muted`、去掉 `transition-colors` |
| 行为 | 可点击跳转 `/settings/profile` | 保持可点击，但无 hover 背景变化 |
| 头像 | `h-8 w-8 rounded-full bg-muted` + `User` 图标 | `h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm` + 首字母 |

**涉及文件**：`app/components/sidebar.tsx` 第 67-84 行

---

### 1.3 头像：拼音首字母大写

**规则**：
- 中文名：取第一个字的拼音首字母大写（如"张浩浩" → "Z"）
- 英文名：取第一个字母大写（如"admin" → "A"）
- 实现位置：`lib/utils.ts` 新增 `getInitials(name: string): string` 函数
- 前端引入 `pinyin-pro` 或自写简单拼音映射（推荐 `pinyin-pro`，npm 安装）
- 如果 `name` 为空，回退到 `username` 的首字母
- 如果都为空，显示 `User` 图标（`h-4 w-4`）

```tsx
// lib/utils.ts 新增
export function getInitials(name: string): string {
  if (!name) return "";
  // 如果首字符是英文字母，直接返回大写
  if (/^[a-zA-Z]/.test(name)) return name.charAt(0).toUpperCase();
  // 中文取拼音首字母（需要 pinyin-pro 或简单映射）
  // 回退：直接取第一个字符
  return name.charAt(0).toUpperCase();
}
```

**头像容器**：
```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
  {initials || <User className="h-4 w-4" />}
</div>
```

**涉及文件**：`lib/utils.ts`（新增函数）、`app/components/sidebar.tsx`（使用）

---

### 1.4 角色标签：换用主题色轻量

| 项 | 当前 | 目标 |
|----|------|------|
| 组件 | `span` 普通文本 | `Badge` 组件（胶囊） |
| 颜色 | `text-[10px] text-muted-foreground`（灰色） | `bg-primary/10 text-primary`（暖橙轻量） |
| 圆角 | 无 | `rounded-full`（胶囊） |
| 尺寸 | 普通 | `text-[10px] px-1.5 py-0 h-4`（紧凑） |

```tsx
// 目标
<Badge className="text-[10px] px-1.5 py-0 h-4 rounded-full font-medium bg-primary/10 text-primary border-0">
  {user.role}
</Badge>
```

**涉及文件**：`app/components/sidebar.tsx` 第 79-83 行

---

### 1.5 文案："登出" → "退出"

| 原文案 | 新文案 | 位置 |
|--------|--------|------|
| 登出 | 退出 | 按钮文字 |
| 已登出 | 已退出 | toast 提示 |
| 登出 | 退出 | title 属性 |

**涉及文件**：`app/components/sidebar.tsx` 第 85-97 行

---

## 二、批次 1：基础通用组件（5 个新建）

### 2.1 EmptyState — 统一空状态

**消除**：各页面内联 3 种不同空状态（约 8 处 × 6 行 = 48 行）

**接口**：
```tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}
```

**使用位置**：Dashboard、Purchases、Ingredients 各子页、Settings 各子页（不包括排程/库存/菜品）

---

### 2.2 LoadingState — 统一加载状态

**消除**：3 种不同加载样式（SkeletonTable、内联 animate-pulse、grid 骨架，约 48 行）

**接口**：
```tsx
interface LoadingStateProps {
  type: "table" | "card-grid" | "page" | "inline";
  cols?: number;
  rows?: number;
  cardCount?: number;
  className?: string;
}
```

**使用位置**：所有列表页面（Purchases、Ingredients 各子页、Settings 各子页等，不包括排程/库存/菜品）

---

### 2.3 StatusBadge — 统一状态标签

已在全局标准化中定义，此处补充**使用范围**：

**使用位置**：Purchases、Ingredients 各子页、Settings 各子页（不包括排程/库存/菜品）

**状态映射**（已确认）：
| 状态文本 | 语义类型 | 颜色映射 |
|----------|----------|----------|
| 已结算 | success | `bg-[var(--status-success-bg)] text-[var(--status-success)]` |
| 已发布 | success | 同上 |
| 待结算 | warning | `bg-[var(--status-warning-bg)] text-[var(--status-warning)]` |
| 待生效 | warning | 同上 |
| 草稿 | neutral | `bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]` |
| 已完成 | neutral | 同上 |
| 已作废 | danger | `bg-[var(--status-danger-bg)] text-[var(--status-danger)]` |
| 进行中 | success | 同上 |

---

### 2.4 FormLabel — 统一表单标签

**推广现有 `FormField` 组件**，不新建。扩展 `FormField` 的使用范围。

**当前使用**：`dish-create-wizard.tsx`、`ingredient-form-dialog.tsx`（部分）

**目标使用**：所有表单页面（Purchases/New、Settings 各子页、Ingredients 各子页，不包括排程/库存/菜品）

**接口**（已存在，保持不变）：
```tsx
interface FormFieldProps {
  label: string;
  required?: boolean;
  readOnly?: boolean;
  children: React.ReactNode;
  className?: string;
}

interface FormSectionProps {
  title: string;
  cols?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}
```

**修改项**：`FormField` 内 `text-red-500` → `text-destructive`（已在全局标准化中处理，此处确认使用）

---

### 2.5 DataTable — 统一数据表格

**消除**：每个列表页面重复内联 Table + CardHeader + Pagination + 搜索框（约 10 页 × 50 行 = 500 行）

**接口**：
```tsx
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  filters?: React.ReactNode;
  emptyState?: EmptyStateProps;
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}
```

**使用范围**：Purchases、Ingredients 各子页、Settings 各子页（不包括排程/库存/菜品）

**注意**：先选 2-3 个典型页面试点（如 Purchases 列表页 + Ingredients 原料页），验证后再全面替换。

---

## 三、批次 2：选择器组件重构（SelectDialog + 3 变体 + 交互优化）

### 3.1 公共外壳：SelectDialog

**抽象 `SearchableSelect` / `SearchableTableSelect` / `TileSelect` 的 70% 重复结构**

**公共结构**：
- 触发按钮：`h-11 w-full justify-between px-4` + `ChevronDown` + 选中值
- Dialog 外壳：`sm:max-w-[560px]` + 标题 + 关闭按钮
- 搜索输入：Input + SearchIcon + `h-11 pl-9`
- 底部取消按钮：`h-11 px-6`
- 状态管理：`open` + `search` + `selected` + `filtered`

**接口**：
```tsx
interface SelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  emptyText?: string;
  onCancel: () => void;
  children: React.ReactNode; // 内容区域由变体提供
}
```

---

### 3.2 变体 A：SelectListMode（替代 SearchableSelect）

**特点**：普通列表 + 单行搜索 + 单选

**接口**：
```tsx
interface SelectListModeProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
}
```

**使用位置**：`SupplierSelect`、`UnitSelect`、Ingredients 表单中的单位选择（不包括排程/库存/菜品）

---

### 3.3 变体 B：SelectTableMode（替代 SearchableTableSelect）

**特点**：表格网格 + 多列信息 + 分页

**接口**：
```tsx
interface SelectTableModeProps<T> {
  data: T[];
  columns: { key: string; header: string; render: (row: T) => React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onChange: (page: number) => void;
  };
}
```

---

### 3.4 变体 C：SelectTileMode（替代 TileSelect）

**特点**：磁贴网格 + 可选描述 + 无分页

**接口**：
```tsx
interface SelectTileModeProps {
  options: { value: string; label: string; description?: string }[];
  value: string;
  onChange: (value: string) => void;
  cols?: 2 | 3;
  searchable?: boolean;
}
```

**使用位置**：DishCreateWizard（非本次范围）、**IngredientFormDialog 中的分类选择**（本次重点）

---

### 3.5 交互优化 1：一二级分类级联选择

**场景**：`ingredient-form-dialog.tsx` 中的食材分类选择

**当前流程**：
1. 点击一级分类选择器（弹出 TileSelect）
2. 选完一级分类后，手动点击二级分类选择器（再弹出 TileSelect）

**目标流程**：
1. 点击一级分类选择器（弹出 TileSelect）
2. 选择一级分类后，**立即自动关闭一级弹窗，并自动弹出二级分类 TileSelect**
3. 二级分类选择完成后关闭

**实现要点**：
- 在 `SelectTileMode` 的 `onChange` 回调中，如果当前是级联场景（传入 `cascadeMode: true`），则先 `onChange` 一级值，然后 `onOpenChange(false)` 关闭一级，同时触发外部传入的 `onOpenNextLevel()` 打开二级
- 或在外部组件（`IngredientFormDialog`）中监听一级分类变化，自动切换二级弹窗的 `open` 状态

**接口扩展**：
```tsx
interface CascadeConfig {
  enabled: boolean;
  onLevelSelected: (level: number, value: string) => void;
  nextLevelOpen: boolean;
  onNextLevelOpenChange: (open: boolean) => void;
}
```

**涉及文件**：`app/components/ingredient-form-dialog.tsx` 中的分类选择区域

---

### 3.6 交互优化 2：带搜索选择器 → 磁贴样式

**场景**：`ingredient-form-dialog.tsx` 中的单位选择（库存单位、采购单位、价格单位）

**当前样式**：`SearchableSelect`（列表下拉，文字列表）

**目标样式**：`SelectTileMode`（磁贴网格，如一级分类的格子选择）

**原因**：单位选项数量少（通常 < 10 个），磁贴更直观，点击区域更大。

**涉及字段**：
- 库存单位
- 采购单位
- 价格单位

**涉及文件**：`app/components/ingredient-form-dialog.tsx` 中单位选择区域

---

## 四、批次 3：IngredientFormDialog 拆分（不分 Tab，拆为 2 个文件）

> 注意：本批次是**代码结构优化**，不改视觉表现。将 485 行单文件拆分为 2 个文件：外壳 + 表单字段。

### 4.1 实际表单字段（8 个）

根据实际代码分析，表单字段如下：

```tsx
interface IngredientFormData {
  name: string;            // 名称（必填）
  l1Code: string;          // 一级分类（必填）
  l2Code: string;          // 二级分类（必填）
  alias: string;           // 商品名称（调料时必填）
  purchaseSpec: string;   // 采购规格（必填）
  purchaseUnit: string;    // 采购单位
  stockUnit: string;       // 库存单位
  latestRefPrice: string;   // 参考价格
}
```

### 4.2 拆分结构（2 个文件）

```
IngredientFormDialog（外壳，~150行）
├── Dialog 外壳 + 左右布局
│   ├── 左侧：表单区域（引用 IngredientFormFields）
│   └── 右侧：同分类已有食材列表（保持原样）
├── 表单数据状态管理（form, setForm）
├── 验证逻辑（validate）
├── 提交逻辑（handleSubmit）
├── 右侧列表加载（fetchRightList）
├── 模式控制（mode: "ingredient" | "seasoning" | "auto"）
└── 底部保存/取消按钮

IngredientFormFields（表单字段，~200行）
├── 名称（Input，必填）
├── 商品名称（Input，条件必填：调料时必填）
├── 一级分类（TileSelect，SelectTileMode）
├── 二级分类（TileSelect，SelectTileMode，级联自动弹出）
├── 采购规格（Input）
├── 采购单位（SelectTileMode，磁贴样式）
├── 库存单位（SelectTileMode，磁贴样式）
└── 参考价格（Input）
```

### 4.3 接口设计

```tsx
// 共享数据类型（从原文件提取）
interface IngredientFormData {
  name: string;
  l1Code: string;
  l2Code: string;
  alias: string;
  purchaseSpec: string;
  purchaseUnit: string;
  stockUnit: string;
  latestRefPrice: string;
}

// 外壳组件接口（保持原文件接口不变）
interface IngredientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id?: number;
    code?: string;
    name?: string;
    l2Code?: string;
    alias?: string | null;
    purchaseSpec?: string | null;
    purchaseUnit?: string | null;
    stockUnit?: string | null;
    latestRefPrice?: number | null;
  };
  categories: CategoryL1[];
  units: Unit[];
  mode?: "ingredient" | "seasoning" | "auto";
  onSuccess: (data: CreatedIngredient) => void;
}

// 表单字段组件接口
interface IngredientFormFieldsProps {
  form: IngredientFormData;
  onChange: (field: keyof IngredientFormData, value: string) => void;
  errors: Record<string, string>;
  categories: CategoryL1[];
  units: Unit[];
  mode: "ingredient" | "seasoning" | "auto";
  // 级联控制
  l2Open: boolean;
  onL2OpenChange: (open: boolean) => void;
}
```

### 4.4 关键字段说明

| 字段 | 组件类型 | 必填 | 备注 |
|------|----------|------|------|
| name | Input | 是 | 食材名称 |
| alias | Input | 条件 | 调料时必填（label 变为"商品名称"） |
| l1Code | SelectTileMode | 是 | 一级分类，选择后触发级联 |
| l2Code | SelectTileMode | 是 | 二级分类，级联自动弹出 |
| purchaseSpec | Input | 是 | 采购规格 |
| purchaseUnit | SelectTileMode | 否 | 采购单位，改为磁贴样式 |
| stockUnit | SelectTileMode | 否 | 库存单位，改为磁贴样式 |
| latestRefPrice | Input | 否 | 参考价格 |

**注意**：
- 原 `latestRefPrice` 在表单状态中是 `string`（输入框值），提交时转为 `number`
- 原 `purchaseUnit` 和 `stockUnit` 当前使用 `SearchableSelect`（列表），目标改为 `SelectTileMode`（磁贴）
- 一二级分类级联逻辑（选择 l1Code 后自动弹出 l2Code）保留在 `IngredientFormFields` 中，通过 `l2Open` 状态控制

### 4.5 涉及文件

- **修改**：`app/components/ingredient-form-dialog.tsx` — 拆分为外壳，约 150 行
- **新建**：`app/components/ingredient-form-fields.tsx` — 表单字段，约 200 行

### 4.6 其他引用检查

确认 `ingredient-form-dialog.tsx` 的引用位置：
- `app/ingredients/raw/page.tsx`
- `app/ingredients/seasoning/page.tsx`
- 其他 ingredients 子页面

确保导出名称不变，或同步更新引用文件。

---

## 五、排除范围

以下模块不参与本次优化：

| 模块 | 路径 | 原因 |
|------|------|------|
| 排程模块 | `app/schedules/` | 用户指定排除 |
| 库存模块 | `app/inventory/` | 用户指定排除 |
| 菜品模块 | `app/dishes/` | 用户指定排除 |

---

## 六、技术约束与红线

- 禁止新增 `any` 类型
- 禁止修改 API 层逻辑（本优化仅改前端组件）
- 禁止修改数据库 Schema
- 禁止修改业务逻辑（状态流转、数据计算等）
- 代码提交前强制检查顺序：`npx tsc --noEmit` → `npm run build` → `npm run lint`
- 选择器重构时，确保原组件的 `props` 接口兼容，或更新所有引用点
- 拆分时确保 `IngredientFormDialog` 的导出不变，或同步更新所有引用文件
- 新增 `pinyin-pro` 依赖需确认 npm 安装成功

---

## 七、验收标准

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 1 | 编译通过 | `npx tsc --noEmit` 无错误 | 命令行 |
| 2 | 构建通过 | `npm run build` 无错误 | 命令行 |
| 3 | Lint 通过 | `npm run lint` 无错误 | 命令行 |
| 4 | Logo 图标 | `Sliders` 图标，h-10 w-10，rounded-md | 浏览器视觉检查 |
| 5 | 用户区域无交互 | 悬停无背景变化 | 浏览器交互验证 |
| 6 | 头像拼音 | 中文名显示拼音首字母大写（如"Z"） | 浏览器视觉检查 |
| 7 | 角色标签 | 胶囊 Badge，bg-primary/10 text-primary，rounded-full | 浏览器视觉检查 |
| 8 | 退出文案 | 无"登出"残留（grep 为空） | 命令行 grep |
| 9 | EmptyState | 至少 3 个页面使用（Purchases/Ingredients/Settings） | 代码审查 |
| 10 | LoadingState | 列表页加载时使用，无内联 animate-pulse | 代码审查 |
| 11 | StatusBadge | 所有状态标签使用组件，无内联硬编码 | 代码审查 |
| 12 | FormField | 表单页面统一使用，无手写 Label + text-red-500 | 代码审查 |
| 13 | DataTable | 至少 2 个典型页面试点（Purchases + Ingredients） | 代码审查 + 浏览器验证 |
| 14 | SelectDialog | 3 个变体均可用，原 SearchableSelect/TileSelect 已删除 | 代码审查 |
| 15 | 级联选择 | 点击一级分类后自动弹出二级分类弹窗 | 浏览器交互验证 |
| 16 | 单位磁贴 | 库存/采购/价格单位使用磁贴样式（非列表） | 浏览器视觉检查 |
| 17 | Dialog 拆分 | ingredient-form-dialog.tsx < 150 行，3 个子组件各 < 150 行 | 代码审查 |
| 18 | 拼音库 | `pinyin-pro` 安装成功，`getInitials` 函数可用 | 命令行 + 浏览器验证 |

---

## 八、相关文件参考

### 全局修正
- `app/components/sidebar.tsx` — Logo、用户区域、头像、角色标签、退出文案
- `lib/utils.ts` — 新增 `getInitials()` 函数

### 批次 1：基础组件
- `app/components/empty-state.tsx` — **新建**
- `app/components/loading-state.tsx` — **新建**
- `app/components/status-badge.tsx` — 已在全局标准化中定义，此处扩展使用
- `app/components/form-field.tsx` — 已存在，推广使用范围
- `app/components/data-table.tsx` — **新建**

### 批次 2：选择器重构
- `app/components/select-dialog.tsx` — **新建（外壳）**
- `app/components/select-list-mode.tsx` — **新建（变体A）**
- `app/components/select-table-mode.tsx` — **新建（变体B）**
- `app/components/select-tile-mode.tsx` — **新建（变体C）**
- `app/components/ingredient-form-dialog.tsx` — 修改（级联选择 + 单位磁贴）
- `app/components/searchable-select.tsx` — **删除**
- `app/components/searchable-table-select.tsx` — **删除**
- `app/components/tile-select.tsx` — **删除**
- `app/components/supplier-select.tsx` — 修改（使用 SelectListMode）
- `app/components/unit-select.tsx` — 修改（使用 SelectListMode）

### 批次 3：Dialog 拆分
- `app/components/ingredient-form-dialog.tsx` — **拆分为外壳**
- `app/components/ingredient-form/basic-form.tsx` — **新建**
- `app/components/ingredient-form/category-form.tsx` — **新建**
- `app/components/ingredient-form/price-form.tsx` — **新建**

### 使用页面（验证范围）
- `app/purchases/page.tsx` — DataTable 试点、EmptyState、LoadingState
- `app/ingredients/raw/page.tsx` — DataTable 试点、EmptyState、LoadingState
- `app/ingredients/net/page.tsx` — DataTable 试点
- `app/ingredients/minor/page.tsx` — DataTable 试点
- `app/ingredients/seasoning/page.tsx` — DataTable 试点
- `app/ingredients/sauce/page.tsx` — DataTable 试点
- `app/settings/users/page.tsx` — DataTable 试点
- `app/settings/suppliers/page.tsx` — DataTable 试点
- `app/settings/categories/page.tsx` — DataTable 试点
- `app/settings/classes/page.tsx` — DataTable 试点
- `app/settings/units/page.tsx` — DataTable 试点
- `app/purchases/new/page.tsx` — FormField 推广
- `app/settings/profile/page.tsx` — FormField 推广
- `app/login/page.tsx` — 无修改（排除）
