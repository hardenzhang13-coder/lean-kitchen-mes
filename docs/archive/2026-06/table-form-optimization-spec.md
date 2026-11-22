# 精益厨房 V3 — 表格与表单组件优化需求文档

> 本文档作为 Claude Code 的完整执行需求输入，涵盖表格组件与表单组件的整体优化。请按本文档描述的设计规范、交互规范、组件接口执行实现，代码层面的设计与执行由 CC 的 plan 模式自主完成。
>
> 当前系统版本：Next.js 16.2.7 / React 19.2.4 / Tailwind CSS v4 / shadcn/ui v4
> 前置依赖：全局标准化（颜色/圆角/高度/字体/微交互动画）已验收通过；组件层基础组件（EmptyState/LoadingState/StatusBadge/SelectDialog）已验收通过
> 排除范围：排程模块、库存模块、菜品模块不参与本次优化

---

## 一、需求总览

| 编号 | 需求模块 | 类型 | 优先级 | 说明 |
|------|----------|------|--------|------|
| 1 | 批次 1：基础组件建设（表格基础 + 表单基础） | 重构 | P1 | 封装 DataTable、统一表单基础组件 |
| 2 | 批次 2：交互与校验层（表格交互 + 表单校验） | 优化 | P1 | 行操作规范、实时校验、级联表单 |
| 3 | 批次 3：高级功能与规范（表格高级 + 表单布局） | 优化 | P2 | 列排序筛选、表单布局规范、响应式 |

---

## 二、详细需求说明

## 批次 1：基础组件建设（表格基础 + 表单基础）

### 1.1 表格基础：DataTable 封装

#### 当前问题
- 10+ 页面各自内联完整 Table + CardHeader + Pagination + 搜索框，约 50 行/页
- 空状态、加载状态、分页逻辑全部重复

#### 目标设计

**DataTable 组件接口**：

```tsx
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];           // 列定义
  loading?: boolean;                  // 加载状态（内部用 LoadingState）
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  filters?: React.ReactNode;          // 搜索框 + 筛选插槽（放在 CardHeader）
  emptyState?: {                      // 空状态配置（用 EmptyState 组件）
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: { label: string; href?: string; onClick?: () => void };
  };
  rowActions?: (row: T) => React.ReactNode; // 操作列（每行右侧）
  onRowClick?: (row: T) => void;      // 整行点击
  className?: string;
}

interface ColumnDef<T> {
  key: string;                        // 数据字段名
  header: string;                     // 表头文案
  width?: string;                      // 列宽（如 "w-[120px]" 或 "flex-1"）
  align?: "left" | "right" | "center"; // 对齐
  render?: (row: T) => React.ReactNode; // 自定义渲染（如 Badge、金额格式化）
  sortable?: boolean;                  // 批次 3 启用
}
```

**DataTable 内部结构**：

```tsx
<Card>
  {filters && <CardHeader className="pb-3">{filters}</CardHeader>}
  <CardContent>
    {loading ? <LoadingState type="table" /> :
     data.length === 0 ? <EmptyState {...emptyState} /> :
     <>
       <Table>
         <TableHeader>
           <TableRow>
             {columns.map(col => <TableHead key={col.key} className={col.width}>{col.header}</TableHead>)}
             {rowActions && <TableHead className="w-[120px] text-right">操作</TableHead>}
           </TableRow>
         </TableHeader>
         <TableBody>
           {data.map(row => (
             <TableRow key={row.id} onClick={() => onRowClick?.(row)} className={onRowClick ? "cursor-pointer" : ""}>
               {columns.map(col => (
                 <TableCell key={col.key} className={col.align ? `text-${col.align}` : ""}>
                   {col.render ? col.render(row) : (row as any)[col.key]}
                 </TableCell>
               ))}
               {rowActions && <TableCell className="text-right">{rowActions(row)}</TableCell>}
             </TableRow>
           ))}
         </TableBody>
       </Table>
       {pagination && <Pagination {...pagination} />}
     </>
    }
  </CardContent>
</Card>
```

**使用位置（试点）**：
- `app/purchases/page.tsx` — 采购单列表（最复杂，有搜索+筛选+分页+操作列）
- `app/ingredients/raw/page.tsx` — 原料清单（标准列表）
- `app/settings/users/page.tsx` — 用户管理（标准列表）

**验证通过后全面替换**：Ingredients 各子页、Settings 各子页、Purchases 子页。

**涉及文件**：
- **新建**：`app/components/data-table.tsx`
- **修改**：试点页面（Purchases、Ingredients/Raw、Settings/Users）

---

### 1.2 表单基础：Form 组件体系

#### 当前问题
- 表单字段封装不统一：部分用 `FormField`，部分直接手写 `<div className="space-y-2">`
- 输入框、选择器、错误提示、提交按钮无统一封装
- 11 处 `text-red-500` 作为必填标记（已在全局标准化中修正，此处确认推广）

#### 目标设计

**表单组件清单**：

```tsx
// 1. FormField — 已存在，扩展使用范围
interface FormFieldProps {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;          // 新增：字段级错误提示
  children: React.ReactNode;
  className?: string;
}

// 2. FormInput — 统一 Input 封装
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  error?: string;
  prefix?: React.ReactNode;  // 前缀（如 ¥ 符号）
  suffix?: React.ReactNode;  // 后缀（如单位）
}
// 内部：h-11 + rounded-md + focus ring-2 ring-primary/15 + border-primary
// 如果有 error：border-destructive + focus:ring-destructive/15

// 3. FormSelect — 统一 Select 封装
interface FormSelectProps {
  label?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  // 底层用 shadcn Select 或自定义 SelectDialog
}
// 内部：SelectTrigger h-11 + rounded-md + error 时边框变红

// 4. FormError — 字段级错误提示
interface FormErrorProps {
  message?: string;
}
// 样式：text-destructive text-sm flex items-center gap-1
// 图标：AlertCircle（h-4 w-4）

// 5. FormActions — 底部操作栏
interface FormActionsProps {
  onCancel?: () => void;
  cancelText?: string;
  onSubmit?: () => void;
  submitText?: string;
  loading?: boolean;
  submitVariant?: "default" | "destructive";
}
// 样式：flex justify-end gap-3 pt-4 border-t
// 按钮：取消 h-11 outline，提交 h-11 default
```

**FormField 扩展**（新增 error 支持）：

```tsx
// 当前 FormField 只包 Label + children
// 目标：增加 error 字段，在 children 下方显示 FormError
<div className={cn("grid gap-2", className)}>
  <Label className="text-base flex items-center gap-1">
    {label}
    {required && <span className="text-destructive">*</span>}
    {!required && <span className="text-muted-foreground text-sm font-normal">(可选)</span>}
  </Label>
  {children}
  {error && <FormError message={error} />}
</div>
```

**使用位置**：
- `app/purchases/new/page.tsx` — 采购单录入表单
- `app/settings/profile/page.tsx` — 个人信息表单
- `app/components/ingredient-form-dialog.tsx` — 食材表单（拆分后）
- `app/components/import-dialog.tsx` — 导入表单

**涉及文件**：
- **新建**：`app/components/form-input.tsx`、`app/components/form-select.tsx`、`app/components/form-error.tsx`、`app/components/form-actions.tsx`
- **修改**：`app/components/form-field.tsx`（增加 error 字段）
- **修改**：所有表单页面（推广使用）

---

## 批次 2：交互与校验层（表格交互 + 表单校验）

### 2.1 表格交互：行操作规范 + 表头固定 + 行选中态

#### 当前问题
- 操作列有的带文字、有的纯图标，无统一规范
- 表格滚动后表头消失（详情弹窗内 Table 无 sticky header）
- 无行 hover/选中态，或各页面写法不一致

#### 目标设计

**2.1.1 操作列统一组件：RowActions**

```tsx
interface RowAction<T> {
  icon: LucideIcon;
  label: string;
  variant?: "default" | "destructive" | "ghost";
  onClick: (row: T) => void;
  confirm?: {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
  };
}

interface RowActionsProps<T> {
  row: T;
  actions: RowAction<T>[];
  className?: string;
}
```

**渲染规范**：
- 使用 `variant="ghost"` + `size="icon"`（28px 方形按钮）
- 图标大小：`h-4 w-4`（16px）
- 按钮间距：`gap-0.5` 在容器上
- 每个按钮有 `title={action.label}`（Tooltip 替代文字）
- 危险操作（delete/void）有 `confirm` 时：点击 → 弹窗确认 → 执行
- 操作列宽度：根据操作数量自动，建议 `w-[100px]`（2 个操作）或 `w-[130px]`（3 个操作）

**操作列按钮映射**：

| 操作 | 图标 | 颜色 | 确认 |
|------|------|------|------|
| 编辑 | `Pencil` | 默认 | 无 |
| 查看 | `Eye` | 默认 | 无 |
| 作废 | `Trash2` | destructive | 是（确认弹窗） |
| 删除 | `Trash2` | destructive | 是（确认弹窗） |
| 发布 | `Send` | 默认 | 无 |
| 撤回 | `RotateCcw` | 默认 | 无 |
| 完成 | `CheckCircle` | 默认 | 无 |

**2.1.2 表头固定（Sticky Header）**

```tsx
// TableHeader 增加 sticky
<TableHeader className="sticky top-0 bg-background z-10">
```

**注意**：需要 Table 外层有 `overflow-auto` 容器（如 `<div className="overflow-auto max-h-[400px]">`），sticky 才生效。

**涉及文件**：
- **新建**：`app/components/row-actions.tsx`
- **修改**：`components/ui/table.tsx`（TableHeader 增加 sticky 支持）
- **修改**：所有使用 Table 的页面（替换操作列为 RowActions）

**2.1.3 行 hover 与选中态**

| 状态 | 效果 | 备注 |
|------|------|------|
| hover | `bg-muted/50` + `transition-colors`（150ms） | 已存在，确认统一 |
| 选中（checkbox） | `data-[state=selected]:bg-muted` | 已存在，扩展使用 |
| 可点击行 | `cursor-pointer` + hover 时轻微阴影 | 新增强调 |

---

### 2.2 表单校验：实时校验 + 提交校验 + 错误提示

#### 当前问题
- 表单只有提交时 alert 级别错误，无字段级错误提示
- 无实时校验，用户提交后才知错误
- 错误提示样式不统一

#### 目标设计

**2.2.1 校验规则体系**

```tsx
interface ValidationRule<T = string> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: T) => string | undefined; // 返回错误文案，无错误返回 undefined
}

type FormValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T[K]>;
};
```

**2.2.2 校验时机**

| 时机 | 行为 | 优先级 |
|------|------|--------|
| blur（失焦） | 单个字段校验，显示错误 | P1 |
| 输入中（onChange） | 如果已有错误，实时清除；不新增错误 | P2 |
| 提交时 | 全量校验，滚动到第一个错误字段 | P1 |
| 服务端返回 | 字段级错误回填到对应字段 | P1 |

**2.2.3 错误提示规范**

- 位置：字段下方，`FormField` 内通过 `error` 属性传入
- 样式：`text-destructive text-sm flex items-center gap-1`
- 图标：`AlertCircle`（`h-4 w-4`）在错误文字左侧
- 动画：出现/消失时 `transition-all duration-150`
- 输入框错误态：`border-destructive` + `focus:ring-destructive/15`

**2.2.4 提交流程规范**

```tsx
// 提交按钮
<FormActions
  onCancel={() => router.back()}
  cancelText="取消"
  onSubmit={handleSubmit}
  submitText="保存"
  loading={submitting}
/>

// 提交逻辑
const handleSubmit = async () => {
  // 1. 全量校验
  const errors = validateForm(form, validationSchema);
  if (Object.keys(errors).length > 0) {
    setErrors(errors);
    // 滚动到第一个错误字段
    const firstErrorField = document.querySelector('[data-error="true"]');
    firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  
  // 2. 提交
  setSubmitting(true);
  try {
    const res = await fetch('/api/...', { method: 'POST', body: JSON.stringify(form) });
    if (!res.ok) {
      const data = await res.json();
      // 服务端字段错误回填
      if (data.fieldErrors) setErrors(data.fieldErrors);
      else toast.error(data.error || '提交失败');
      return;
    }
    toast.success('保存成功');
    onSuccess?.();
  } catch {
    toast.error('网络错误');
  } finally {
    setSubmitting(false);
  }
};
```

**涉及文件**：
- **新建**：`lib/form-validation.ts`（校验工具函数）
- **修改**：`app/components/form-field.tsx`（增加 error 支持）
- **新建**：`app/components/form-error.tsx`（错误提示组件）
- **修改**：所有表单页面（替换提交逻辑为统一流程）

---

### 2.3 级联表单优化（食材分类选择）

已在组件层优化中定义，此处补充到表单校验体系：

- 选择一级分类后，**清空二级分类**（如果一级变更）
- 二级分类选择后，**校验**是否属于当前一级分类
- 如果校验失败（如手动修改 URL 参数），显示错误提示

---

## 批次 3：高级功能与规范（表格高级 + 表单布局）

### 3.1 表格高级功能

#### 3.1.1 列排序（Sortable Columns）

```tsx
interface ColumnDef<T> {
  // ... 已有字段
  sortable?: boolean;  // 是否可排序
  sortKey?: string;    // 排序字段名（默认用 key）
}

interface DataTableProps<T> {
  // ... 已有字段
  sort?: { key: string; direction: "asc" | "desc" };
  onSort?: (key: string, direction: "asc" | "desc") => void;
}
```

**交互**：
- 点击表头：第一次升序（asc），第二次降序（desc），第三次取消排序
- 排序图标：`ArrowUpDown`（默认）→ `ArrowUp`（升序）→ `ArrowDown`（降序）
- 图标位置：表头文字右侧，`h-3.5 w-3.5`，`text-muted-foreground`

#### 3.1.2 列筛选（Column Filter）

```tsx
interface ColumnDef<T> {
  filterable?: boolean;
  filterType?: "text" | "select" | "date";
  filterOptions?: { value: string; label: string }[]; // select 类型
}
```

**交互**：
- 表头右侧增加筛选图标（`Filter`，h-3.5 w-3.5）
- 点击弹出 Popover 筛选面板
- 文本类型：Input 输入筛选
- 选择类型：Select 下拉筛选
- 日期类型：DatePicker 范围筛选

#### 3.1.3 响应式与列宽规范

**列宽分配规范**：

| 列类型 | 建议宽度 | 对齐 |
|--------|----------|------|
| ID/编号 | `w-[80px]` | 左对齐 |
| 状态 | `w-[100px]` | 居中 |
| 名称/摘要 | `flex-1` 或 `min-w-[200px]` | 左对齐 |
| 金额/数量 | `w-[120px]` | 右对齐 |
| 日期 | `w-[140px]` | 左对齐 |
| 操作列 | `w-[100px]` 或 `w-[130px]` | 右对齐 |

**响应式**：
- 表格外层容器 `overflow-x-auto`
- 关键列（名称/操作）固定，其他列可横向滚动
- 移动端：DataTable 自动切换为卡片列表（批次 3 可选）

**涉及文件**：
- **修改**：`app/components/data-table.tsx`（增加 sort/filter/响应式支持）

---

### 3.2 表单布局规范

#### 3.2.1 表单布局层级

| 场景 | 列数 | 分组 | 间距 |
|------|------|------|------|
| 简单表单（≤ 5 字段） | 1 列 | 无分组 | `gap-5` |
| 中等表单（6-10 字段） | 2 列 | 1-2 个 FormSection | 分组内 `gap-5`，分组间 `gap-6` |
| 复杂表单（10+ 字段） | 2 列 | 3+ 个 FormSection | 分组内 `gap-5`，分组间 `gap-6` |
| 弹窗表单（Dialog） | 1 列 | 无分组 | `gap-4`（弹窗空间紧凑） |

#### 3.2.2 表单分组（FormSection）

已有 `FormSection` 组件，扩展使用：

```tsx
interface FormSectionProps {
  title: string;        // 分组标题
  description?: string; // 分组描述（可选）
  cols?: 1 | 2 | 3 | 4;  // 列数
  children: React.ReactNode;
  className?: string;
}
```

**样式规范**：
- 容器：`rounded-lg border bg-muted/20 p-5 space-y-4`
- 标题：`text-sm font-semibold text-muted-foreground uppercase tracking-wider`
- 描述（新增）：`text-xs text-muted-foreground mt-1`（在标题下方）
- 内容网格：`grid gap-5` + `grid-cols-1/2/3/4`

#### 3.2.3 表单提交流程规范

```
┌─────────────────────────────────────┐
│  1. 用户填写表单                      │
│  2. blur 时单字段校验（显示错误）      │
│  3. 点击保存                         │
│  4. 全量校验（如果有错误：滚动到第一  │
│     个错误字段 + 显示错误）            │
│  5. 校验通过 → 提交 API              │
│  6. 服务端返回错误 → 字段回填 + Toast │
│  7. 成功 → Toast 成功 + 关闭弹窗/跳转 │
└─────────────────────────────────────┘
```

**提交按钮状态**：
- 默认："保存"
- 加载中：`<Loader2 className="mr-2 h-4 w-4 animate-spin" /> 保存中...`
- 成功：短暂显示"已保存"（1 秒），然后关闭
- 禁用：校验未通过时按钮不禁用（让用户点击后看到错误），但 loading 时禁用

**涉及文件**：
- **修改**：`app/components/form-section.tsx`（增加 description）
- **修改**：`app/components/form-actions.tsx`（按钮状态管理）
- **修改**：所有表单页面（统一布局规范）

---

## 三、排除范围

以下模块不参与本次优化：

| 模块 | 路径 | 原因 |
|------|------|------|
| 排程模块 | `app/schedules/` | 用户指定排除 |
| 库存模块 | `app/inventory/` | 用户指定排除 |
| 菜品模块 | `app/dishes/` | 用户指定排除 |

---

## 四、技术约束与红线

- 禁止新增 `any` 类型
- 禁止修改 API 层逻辑（仅改前端组件与表单校验）
- 禁止修改数据库 Schema
- 禁止修改业务逻辑（状态流转、数据计算）
- 代码提交前强制检查顺序：`npx tsc --noEmit` → `npm run build` → `npm run lint`
- DataTable 的 `ColumnDef` 中 `render` 函数使用时注意类型安全
- 表单校验函数 `validateForm` 必须纯函数，不依赖外部状态

---

## 五、验收标准

### 批次 1 验收

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 1-1 | 编译通过 | `npx tsc --noEmit` 无错误 | 命令行 |
| 1-2 | 构建通过 | `npm run build` 无错误 | 命令行 |
| 1-3 | Lint 通过 | `npm run lint` 无错误 | 命令行 |
| 1-4 | DataTable | 试点页面（Purchases/Ingredients/Settings）使用 DataTable，无内联 Table | 代码审查 |
| 1-5 | EmptyState | 数据为空时使用 EmptyState 组件，无内联空状态 | 代码审查 + 浏览器 |
| 1-6 | LoadingState | 加载时使用 LoadingState 组件，无内联 animate-pulse | 代码审查 + 浏览器 |
| 1-7 | FormInput | 所有 Input 使用 FormInput（或 h-11 + rounded-md + focus ring），无原生 Input 直接写 className | 代码审查 |
| 1-8 | FormSelect | 所有 Select 使用 FormSelect，触发器 h-11 | 代码审查 |
| 1-9 | FormField | 表单字段统一使用 FormField（含 Label + 必填 + error），无手写 `<div className="space-y-2">` | 代码审查 |
| 1-10 | FormActions | 表单底部使用 FormActions（取消 + 保存，h-11） | 代码审查 |

### 批次 2 验收

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 2-1 | RowActions | 操作列使用 RowActions 组件，纯图标 + title + 危险操作确认弹窗 | 代码审查 + 浏览器交互 |
| 2-2 | 表头固定 | 表格容器 overflow-auto 时，TableHeader sticky 生效 | 浏览器交互（滚动） |
| 2-3 | 行 hover | 表格行 hover 时 bg-muted/50，过渡 150ms | 浏览器交互 |
| 2-4 | 字段校验 | blur 时单字段校验，显示 FormError | 浏览器交互 |
| 2-5 | 提交校验 | 提交时全量校验，滚动到第一个错误字段 | 浏览器交互 |
| 2-6 | 服务端错误 | 模拟 API 400 返回，字段错误回填到对应字段 | 浏览器交互 |
| 2-7 | 级联表单 | 选择一级分类后清空二级分类，二级选择后校验 | 浏览器交互 |

### 批次 3 验收

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 3-1 | 列排序 | 点击表头可排序，图标切换正确 | 浏览器交互 |
| 3-2 | 列筛选 | 点击筛选图标可筛选，结果正确 | 浏览器交互 |
| 3-3 | 列宽规范 | 所有列有合理宽度，无挤压/溢出 | 浏览器视觉检查 |
| 3-4 | 响应式 | 表格横向滚动时，关键列可见 | 浏览器 DevTools 模拟移动端 |
| 3-5 | 表单布局 | 表单页面按规范使用 1/2 列 + FormSection | 代码审查 + 浏览器 |
| 3-6 | 提交按钮 | loading 时有 Spinner 动画，成功后有反馈 | 浏览器交互 |

---

## 六、相关文件参考

### 新建组件（批次 1）
- `app/components/data-table.tsx` — DataTable 封装
- `app/components/form-input.tsx` — 统一 Input 封装
- `app/components/form-select.tsx` — 统一 Select 封装
- `app/components/form-error.tsx` — 字段错误提示
- `app/components/form-actions.tsx` — 底部操作栏

### 新建组件（批次 2）
- `app/components/row-actions.tsx` — 操作列统一组件
- `lib/form-validation.ts` — 表单校验工具

### 修改组件
- `app/components/form-field.tsx` — 增加 error 支持
- `app/components/form-section.tsx` — 增加 description
- `components/ui/table.tsx` — 增加 sticky header 支持

### 使用页面（批次 1 试点）
- `app/purchases/page.tsx` — DataTable 试点（最复杂）
- `app/ingredients/raw/page.tsx` — DataTable 试点
- `app/settings/users/page.tsx` — DataTable 试点
- `app/purchases/new/page.tsx` — 表单基础组件试点
- `app/settings/profile/page.tsx` — 表单基础组件试点

### 使用页面（全面替换）
- `app/ingredients/*/page.tsx` — 各子页 DataTable
- `app/settings/*/page.tsx` — 各子页 DataTable
- `app/purchases/reimbursements/page.tsx` — DataTable
- `app/components/ingredient-form-dialog.tsx` — 表单组件（拆分后）
- `app/components/import-dialog.tsx` — 表单组件

---

## 七、与组件层优化的衔接

本文档与 `component-layer-optimization-spec.md` 的关系：

| 本文档 | 组件层优化 | 关系 |
|--------|-----------|------|
| DataTable | 批次 1 DataTable | **本文档更详细**，包含列定义、排序、筛选、响应式 |
| FormField | 批次 1 FormField | **本文档扩展**，增加 error 字段 |
| RowActions | 批次 1 StatusBadge | 本文档新增（操作列独立组件） |
| FormInput/FormSelect/FormError/FormActions | 无 | 本文档新增（表单基础组件） |
| FormValidation | 无 | 本文档新增（校验工具） |
| 级联表单 | 批次 2 选择器重构 | **本文档补充**，增加校验逻辑 |

**执行顺序**：
1. 先执行 `component-layer-optimization-spec.md`（基础组件 + 选择器 + Dialog 拆分）
2. 再执行本文档（表格与表单深化）

如果 CC 已执行完组件层优化，本文档可直接独立加载执行。
