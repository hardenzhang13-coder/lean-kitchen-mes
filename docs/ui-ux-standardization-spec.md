# 精益厨房 V3 — UI/UX 标准化需求文档（含补充）

> 本文档作为 Claude Code 的完整执行需求输入，涵盖 8 项 UI/UX 标准化工作。请按本文档描述的设计规范、组件行为、颜色映射执行实现，代码层面的设计与执行由 CC 的 plan 模式自主完成。
> 
> 当前系统版本：Next.js 16.2.7 / React 19.2.4 / Tailwind CSS v4 / shadcn/ui v4

---

## 一、需求总览

| 编号 | 需求 | 类型 | 优先级 | 说明 |
|------|------|------|--------|------|
| 1 | 颜色系统标准化：移除暗色模式，建立语义化状态颜色 | 修正 | P0 | 移除 `.dark` 区块，用 CSS 语义变量替代 50+ 处硬编码颜色 |
| 2 | 圆角降级：保守降一级 | 优化 | P1 | 容器 8px→6px，控件 8px→4px，标签保持胶囊 |
| 3 | Focus 交互极简模式 | 优化 | P1 | 仅 border-color 变色，不添加 shadow/ring 光晕 |
| 4 | 高度与字体统一 | 修正 | P1 | 输入框统一 h-11，字体系统简化为 DM Sans |
| 5 | 状态标签统一组件化 | 修正 | P1 | 新建 `StatusBadge` 组件，统一 4+ 页面的状态标签 |
| 6 | 表格行高度中等化 + 操作列纯图标 | 修正 | P1 | 行高 h-12 / py-3，操作列去掉文字只留图标 |
| 7 | 分页组件增加首页/尾页 | 优化 | P1 | 在 Pagination 组件增加首/尾页快捷按钮 |
| 8 | 自定义选择器图标改为向下箭头 | 修正 | P1 | SearchableSelect / TileSelect / IngredientPicker 图标从 ChevronsUpDown 改为 ChevronDown |

---

## 二、详细需求说明

### 需求 1：颜色系统标准化（P0）

#### 现状问题
- `globals.css` 存在完整的 `.dark` 区块，但本项目不使用暗色模式
- 全局 50+ 处硬编码 `bg-{color}-100 text-{color}-700` 颜色，与主题变量脱节
- 11 处 `text-red-500` 作为必填标记，未使用 `text-destructive`
- Sidebar 品牌色已改为 `primary`（用户已确认），但其他硬编码颜色仍大量存在

#### 目标设计

**CSS 颜色系统：**

```css
/* globals.css :root 中新增语义化状态变量 */
--status-success: #22c55e;
--status-success-bg: #f0fdf4;
--status-warning: #f59e0b;
--status-warning-bg: #fffbeb;
--status-danger: #ef4444;
--status-danger-bg: #fef2f2;
--status-neutral: #6b7280;
--status-neutral-bg: #f9fafb;
--status-info: #3b82f6;
--status-info-bg: #eff6ff;
--status-primary: #ea580c;       /* 暖橙色映射 */
--status-primary-bg: #fff7ed;

/* 分类标签语义变量（保留分类可识别性） */
--tag-veg: #22c55e; --tag-veg-bg: #f0fdf4;   /* 蔬菜 */
--tag-mea: #ef4444; --tag-mea-bg: #fef2f2;   /* 肉类 */
--tag-aqu: #3b82f6; --tag-aqu-bg: #eff6ff;   /* 水产 */
--tag-pou: #f59e0b; --tag-pou-bg: #fffbeb;   /* 禽类 */
--tag-dry: #f97316; --tag-dry-bg: #fff7ed;   /* 干货 */
--tag-bea: #06b6d4; --tag-bea-bg: #ecfeff;   /* 豆类 */
--tag-prc: #8b5cf6; --tag-prc-bg: #f5f3ff;   /* 加工品 */
--tag-gra: #64748b; --tag-gra-bg: #f8fafc;   /* 谷物 */
--tag-sea: #ec4899; --tag-sea-bg: #fdf2f8;   /* 海鲜 */
```

**硬编码颜色替换映射：**

| 原硬编码 | 替换为 | 适用场景 |
|----------|--------|----------|
| `bg-green-100 text-green-700` | `bg-[var(--status-success-bg)] text-[var(--status-success)]` | 成功态：已结算、已发布 |
| `bg-amber-100 text-amber-700` | `bg-[var(--status-warning-bg)] text-[var(--status-warning)]` | 警告态：待结算、待生效 |
| `bg-red-100 text-red-700` | `bg-[var(--status-danger-bg)] text-[var(--status-danger)]` | 危险态：已作废、删除 |
| `bg-gray-100 text-gray-700/600` | `bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]` | 中性态：草稿、已完成 |
| `bg-blue-100 text-blue-700` | `bg-[var(--status-info-bg)] text-[var(--status-info)]` | 信息态：原料、AI 来源 |
| `bg-indigo-50 text-indigo-500` | `bg-primary/10 text-primary` | 激活态、品牌色（已确认） |
| `bg-indigo-500` | `bg-primary` | 品牌标识（已确认） |
| `text-red-500` | `text-destructive` | 必填标记 |

**分类标签（CategoryTag）**：保留 10 种分类色的功能可识别性，但将颜色定义迁移到 `globals.css` 的 `--tag-*` 变量，组件内通过 CSS 变量引用，不再硬编码 Tailwind 类名。

**涉及范围**：`globals.css`（移除 `.dark`、新增变量）、`category-tag.tsx`、所有页面中内联定义的状态标签（`purchases/page.tsx`、`schedules/page.tsx`、`schedules/[id]/page.tsx`、`dishes/page.tsx`、`dishes/[id]/page.tsx`、`inventory/page.tsx`、`inventory/ledger/page.tsx`、`purchases/reimbursements/` 各页面）、`form-field.tsx`、`dish-create-wizard.tsx` 等。

**注意事项**：`text-red-500` 替换为 `text-destructive` 时，确保 `--destructive` 变量在亮色模式下有合适的颜色值。

---

### 需求 2：圆角降级（P1）

#### 现状问题
- 当前 `globals.css` 中所有 `--radius-*` 变量统一为 `0.5rem`（8px），但实际组件渲染圆角值因 Tailwind 类名写法不同而不一致
- Card 使用 `rounded-[min(var(--radius-4xl),24px)]`，Button 使用 `rounded-2xl`，变量写法混乱
- 整体视觉效果偏圆，需要"更方正、更专业"的感觉

#### 目标设计

**降级规则（保守降一级）：**

| 层级 | 组件 | 当前圆角 | 降级后 | 说明 |
|------|------|----------|--------|------|
| 容器级 | Card、Dialog | 约 8px | 6px | 内容容器，稍圆润 |
| 控件级 | Button、Input、Select、Textarea | 约 8px | 4px | 操作控件，更方正 |
| 导航级 | Sidebar NavItem | 约 8px | 4px | 与控件级一致 |
| 标签级 | Badge、Tag | `full` | `full` | 保持胶囊形态 |

**变量定义**：在 `globals.css` 的 `@theme inline` 区块中重新定义圆角变量，按层级区分：
- 容器级：`--radius-lg` = 0.375rem（6px）
- 控件级：`--radius-md` = 0.25rem（4px），`--radius-sm` = 0.125rem（2px）
- 标签级：保持 `--radius-full` 或 `9999px`

**组件绑定**：
- Card：`rounded-lg`（使用容器级变量）
- Dialog：`rounded-lg`（与 Card 同级）
- Button：`rounded-md`（使用控件级变量）
- Input/Select：`rounded-md`（与 Button 同级）
- Sidebar NavItem：`rounded-md`（与 Button 同级）
- Badge/Tag：`rounded-full`

**涉及范围**：`globals.css`（圆角变量重定义）、`components/ui/card.tsx`（替换圆角写法）、`components/ui/button.tsx`（替换圆角类名）、`components/ui/dialog.tsx`（替换圆角）、`app/components/date-picker.tsx`（Popover 触发器圆角）、所有 Input 和 Select 组件。

**注意事项**：`components/ui/button.tsx` 当前使用 `rounded-2xl`，但 `--radius-2xl` 被覆盖为 0.5rem，实际效果约 8px。降级后改为 `rounded-md`（约 4px）。注意不要误改 `icon` 类按钮的方形要求。

---

### 需求 3：Focus 交互极简模式（P1）

#### 现状问题
- `globals.css` 中全局输入框 focus 效果使用硬编码 Apple 蓝：
  ```css
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #007AFF;
    box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.06);
  }
  ```
- 与主题暖橙色冲突，且 box-shadow 不符合极简风格

#### 目标设计

**极简 Focus 规则：**
- 不添加 `box-shadow`（移除 glow 效果）
- 不添加 `ring`（移除 outline 发光）
- 仅改变 `border-color` 为 `var(--primary)`（暖橙色）
- 保持 `outline: none`（移除浏览器默认 outline）
- 保持 `transition: all 0.2s ease`（平滑过渡）

```css
/* 目标效果 */
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--primary);
  /* 无 box-shadow，无 ring */
}
```

**涉及范围**：`globals.css`（修改 `@layer base` 中的 focus 规则）。

**注意事项**：仅影响原生 `input`、`select`、`textarea`。shadcn/ui 的 Input 组件如果使用了 `focus-visible:ring-2` 等，需要额外处理。确认 `components/ui/input.tsx` 中是否有 ring 相关类名，如有则移除。

---

### 需求 4：高度与字体统一（P1）

#### 4.1 高度统一

**基准**：`ingredient-form-dialog.tsx` 中所有输入框和按钮统一为 `h-11`（44px）。

**目标**：
- 所有输入框（Input、Select Trigger、DatePicker Trigger、SearchableSelect Trigger、TileSelect Trigger、IngredientPicker Trigger）：统一为 `h-11`
- 所有表单中的按钮（保存、取消、确认）：`h-11`
- 表格内操作按钮（编辑、删除、详情）：保持 `h-9`（紧凑场景）
- 分页按钮：保持 `h-9`
- Sidebar 导航项：保持 `h-16 w-16`（大图标区域，不改动）

**例外**：`ProcessTimeline` 中的步骤操作按钮（添加、删除）位于表格内紧凑场景，保持 `h-9`。

**涉及范围**：`app/components/date-picker.tsx`（h-11）、`app/components/searchable-select.tsx`（h-11）、`app/components/tile-select.tsx`（h-11）、`app/components/ingredient-picker.tsx`（h-11）、`dish-create-wizard.tsx`（h-10→h-11）、`app/components/import-dialog.tsx`（h-11）。

#### 4.2 字体简化

**现状**：`layout.tsx` 声明了 4 种字体变量（Geist Sans、Geist Mono、DM Sans、Public Sans），但 Geist Sans 声明后未使用。

**目标**：
- 移除未使用的 `Geist` 和 `Public_Sans` 导入
- 统一使用 `DM Sans` 作为 `font-sans`（body + heading）
- 保留 `Geist_Mono` 作为 `font-mono`（代码/数字场景）
- 实际在 CSS 中：`--font-sans` 和 `--font-heading` 都指向 DM Sans

**字体层级规范**：

| 层级 | 字号 | 字重 | 用途 | 备注 |
|------|------|------|------|------|
| 页面标题 | `text-2xl` | `font-bold` | PageHeader title | 使用 font-heading |
| 区块标题 | `text-lg` | `font-semibold` | Card 区块标题、Tab 标题 | |
| 卡片标题 | `text-base` | `font-semibold` | CardTitle、DialogTitle | 当前 `font-heading` |
| 正文 | `text-sm` | `font-normal` | 表格内容、描述文字 | |
| 标签/辅助 | `text-xs` | `font-medium` | Badge、Tag、表格头 | |
| 导航标签 | `text-xs` | `font-bold` | Sidebar 导航文字 | 保持现有 |
| 徽标文字 | `text-[10px]` | `font-medium` | 用户名、角色徽标 | 最小字号 |

**清理**：所有页面中混用的 `text-[9px]` 统一替换为 `text-xs`（如 Sidebar 中的角色 Badge 等）。

**涉及范围**：`app/layout.tsx`（字体导入清理）、`globals.css`（font 变量定义）、`components/ui/card.tsx`（CardTitle 字体）、`components/ui/dialog.tsx`（DialogTitle 字体）、各页面中 `text-[9px]` 的替换。

**注意事项**：`Geist_Mono` 保留用于数字/代码场景（如金额、ID、日期），但当前项目未明显使用等宽字体，所以简化方案是仅声明 `DM Sans` 和 `Geist_Mono`。

---

### 需求 5：状态标签统一组件化（P1）

#### 现状问题
- 4+ 页面各自定义 `StatusBadge` 函数组件，样式不统一
- 状态映射关系散落在各页面中，修改一个状态色需要改 4 个文件

#### 目标设计

**新建组件**：`app/components/status-badge.tsx`

**状态映射表**：

| 状态文本 | 语义类型 | 颜色映射 |
|----------|----------|----------|
| 已结算 | success | `bg-[var(--status-success-bg)] text-[var(--status-success)]` |
| 已发布 | success | 同上 |
| 待结算 | warning | `bg-[var(--status-warning-bg)] text-[var(--status-warning)]` |
| 待生效 | warning | 同上 |
| 草稿 | neutral | `bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]` |
| 已完成 | neutral | 同上 |
| 已作废 | danger | `bg-[var(--status-danger-bg)] text-[var(--status-danger)]` |
| 进行中 | success | 同上（success） |

**组件接口**：
```tsx
interface StatusBadgeProps {
  status: string;
  size?: "default" | "sm";
  className?: string;
}
```

**涉及范围**：新建 `app/components/status-badge.tsx`，替换以下文件中的内联 `StatusBadge` 函数：
- `purchases/page.tsx`
- `schedules/page.tsx`
- `schedules/[id]/page.tsx`
- `dishes/page.tsx`（dish-card.tsx 中的状态标签）
- `dishes/[id]/page.tsx`
- `inventory/page.tsx`
- `inventory/ledger/page.tsx`
- `purchases/reimbursements/page.tsx`
- `purchases/reimbursements/[id]/page.tsx`

**注意事项**：dish-card.tsx 中当前使用 `span` + 内联样式定义状态标签，也需要替换为 `StatusBadge` 组件。

---

### 需求 6：表格行高度中等化 + 操作列纯图标（P1）

#### 6.1 表格行高度中等化

#### 现状问题
- 当前 `TableHead` 有 `h-10`（40px），但 `TableCell` 只有 `p-2`（8px padding），行高由内容自适应
- 内容较少时行高过矮，信息密集显得拥挤，需要中等行高提升可读性

#### 目标设计

**中等行高规范**：
- `TableHead`：保持 `h-10`（40px，表头紧凑）
- `TableCell`：从 `p-2` 改为 `py-3 px-2`（纵向 padding 12px，横向 8px），或统一为 `p-3`（12px）
- 效果：数据行内容区约 48-56px，视觉中等，不拥挤也不松散

**推荐方案**：`TableCell` 改为 `py-3 px-2`（纵向 12px + 横向 8px），配合行高后整体行高约 48-52px。

**涉及范围**：`components/ui/table.tsx`（修改 `TableCell` 的 className）。

**注意事项**：修改后检查所有使用 Table 的页面（purchases、inventory、schedules 等），确保内容对齐正常。部分单元格内有 Badge/按钮，增加 padding 后不应破坏垂直居中（已使用 `align-middle`）。

#### 6.2 操作列纯图标化

#### 现状问题
- 表格操作列当前使用 `Button variant="ghost" size="sm"` + Lucide 图标 + 文字，如：
  ```tsx
  <Button variant="ghost" size="sm"><Pencil className="mr-1 h-4 w-4" /> 编辑</Button>
  ```
- 操作列文字占用横向空间，在列多时容易溢出

#### 目标设计

**操作列规范**：
- 操作按钮改为**纯图标按钮**，不带文字
- 使用 `variant="ghost"` + `size="icon"`（或 `size="icon-sm"`，28px）
- 保留 `title` 属性提供 Tooltip 说明（鼠标悬停显示操作含义）
- 图标大小：h-4 w-4（16px）
- 按钮间距：使用 `gap-1` 或 `gap-0.5` 在容器上控制

**操作列按钮映射**：

| 操作 | 图标 | title |
|------|------|-------|
| 编辑 | `Pencil` | "编辑" |
| 详情 | `Eye` | "查看详情" |
| 删除/作废 | `Trash2` | "作废" |
| 彻底删除 | `Trash2` | "彻底删除" |
| 发布 | `Send` | "发布" |
| 撤回 | `RotateCcw` | "撤回" |

**涉及范围**：所有表格操作列：
- `purchases/page.tsx`（编辑、详情、作废、删除）
- `inventory/page.tsx`（查看台账）
- `inventory/ledger/page.tsx`（查看）
- `settings/users/page.tsx`（编辑、删除）
- `settings/suppliers/page.tsx`（编辑、删除）
- `settings/categories/page.tsx`（编辑、删除）
- `settings/classes/page.tsx`（编辑、删除）
- `settings/units/page.tsx`（编辑、删除）
- `schedules/page.tsx`（详情、编辑、完成）
- `ingredients/` 各子页面（编辑、删除）
- `dishes/page.tsx`（编辑、发布/撤回）

**注意事项**：部分操作列按钮有文字是为了明确区分操作含义（如"作废" vs "彻底删除"），纯图标后需通过 `title` 属性区分。操作列宽度可适当收窄（从 `w-[160px]` 或 `w-[140px]` 调整为 `w-[120px]` 或 `w-auto`）。

---

### 需求 7：分页组件增加首页/尾页（P1）

#### 现状问题
- 当前 `Pagination` 组件只有"上一页"和"下一页"两个按钮
- 在总页数较多时（如 20+ 页），跳转到首/尾页需要多次点击

#### 目标设计

**分页组件布局（从左到右）**：
```
[首页] [上一页]  第 X / Y 页  [下一页] [尾页]
```

**按钮规范**：
- 首页按钮：使用 `ChevronFirst`（`<<` 图标）或 `ChevronsLeft`（`<<<`）图标
  - 文字：不保留（纯图标按钮，使用 `variant="ghost"` + `size="icon"`）
  - 或使用 `Button variant="outline" size="sm"` 带文字"首页"（保持与现有风格一致）
- 尾页按钮：使用 `ChevronLast` 或 `ChevronsRight` 图标
- 禁用规则：
  - 首页按钮：当前页为 1 时禁用
  - 尾页按钮：当前页等于 totalPages 时禁用
  - 上一页/下一页保持现有禁用规则

**按钮顺序**：
1. 首页（`<<` 或 "首页"）— 跳转到第 1 页
2. 上一页（`<` 或 "上一页"）— 跳转到 currentPage - 1
3. 页码显示（第 X / Y 页）— 保持现有
4. 下一页（`>` 或 "下一页"）— 跳转到 currentPage + 1
5. 尾页（`>>` 或 "尾页"）— 跳转到 totalPages

**按钮样式选择**：用户偏好一致，建议保持与现有按钮风格一致（带文字）：
- 首页：`<ChevronFirst className="h-4 w-4 mr-1" /> 首页`
- 尾页：`尾页 <ChevronLast className="h-4 w-4 ml-1" />`
- 如果 `ChevronFirst`/`ChevronLast` 在 lucide-react 中不存在，使用 `ChevronsLeft`/`ChevronsRight` 替代，或使用双 `ChevronLeft`/`ChevronRight` 组合

**涉及范围**：`app/components/pagination.tsx`。

**注意事项**：`ChevronFirst` 和 `ChevronLast` 在 lucide-react 中可能不存在，需检查可用图标。替代方案：
- A. `ChevronsLeft` / `ChevronsRight`（`<<` / `>>` 双箭头）
- B. 组合两个 `ChevronLeft` / `ChevronRight` 图标
- C. 纯文字按钮："首页" / "尾页"，不带图标

---

### 需求 8：自定义选择器图标改为向下箭头（P1）

#### 现状问题
- 自定义选择器组件（SearchableSelect、TileSelect、IngredientPicker）使用 `ChevronsUpDown` 图标（上下双箭头），表示可展开/收起
- 但用户希望改为单一向下箭头 `ChevronDown`，更简洁明确

#### 目标设计

**图标替换规则**：
- 所有自定义选择器组件的触发按钮/触发器末尾图标，从 `ChevronsUpDown` 改为 `ChevronDown`
- 保持图标大小不变（`h-4 w-4`）
- 保持 `text-muted-foreground` 颜色不变

**涉及组件**：
- `app/components/searchable-select.tsx`：第 5 行导入、第 97 行使用
- `app/components/tile-select.tsx`：第 5 行导入、第 100 行使用
- `app/components/ingredient-picker.tsx`：检查是否有 `ChevronsUpDown` 图标，如有则替换
- `app/components/date-picker.tsx`：当前使用 `CalendarIcon`，不涉及，保持不动
- `components/ui/select.tsx`：shadcn 原生 Select 已使用 `ChevronDownIcon`，保持不动

**涉及范围**：`app/components/searchable-select.tsx`、`app/components/tile-select.tsx`、`app/components/ingredient-picker.tsx`（如有）。

**注意事项**：仅替换图标，不改动其他交互逻辑（如点击展开、搜索过滤等）。确认 lucide-react 中 `ChevronDown` 已可用（项目中已有 `import { ChevronDown }` 的其他引用，确认可用）。

---

## 三、数据模型变更

无变更。本标准化仅涉及前端视觉层。

---

## 四、API 接口变更

无变更。

---

## 五、交互设计与页面规范

### 全局布局保持
- 页面根容器保持 `flex flex-col gap-6 p-8`
- Sidebar 布局保持 `w-20` 固定左侧
- 页面标题保持 `PageHeader` 组件

### Tab/Filter 切换样式
- 保持现有 `bg-muted rounded-lg p-1` 容器 + `bg-background shadow-sm` 激活态
- 不做改动

### 空状态（后续迭代）
- 本次迭代中各页面空状态可保留现有内联实现
- 状态标签统一是本次重点

---

## 六、技术约束与红线

- **禁止新增 `any` 类型**
- **禁止修改 API 层逻辑**（本标准化仅改前端）
- **禁止修改数据库 Schema**
- **禁止修改业务逻辑**（状态流转、数据计算等）
- 代码提交前强制检查顺序：`npx tsc --noEmit` → `npm run build` → `npm run lint`
- 修改 `globals.css` 时确保所有 CSS 变量定义在 `:root` 内，无 `.dark` 区块
- 修改 shadcn/ui 组件时（如 button.tsx、card.tsx），确保不破坏现有 API 接口（props 不变）
- 表格操作列去掉文字后，确保操作按钮保留 `title` 属性，避免用户无法识别操作含义
- 分页组件的 lucide-react 图标如 `ChevronFirst`/`ChevronLast` 不可用，使用备选方案

---

## 七、验收标准

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 1 | 编译通过 | `npx tsc --noEmit` 无错误 | 命令行 |
| 2 | 构建通过 | `npm run build` 无错误 | 命令行 |
| 3 | Lint 通过 | `npm run lint` 无错误 | 命令行 |
| 4 | 颜色一致性 | 全局无 `bg-{color}-100 text-{color}-700` 硬编码（grep 搜索为空） | 命令行 `grep` |
| 5 | 必填标记 | 全局无 `text-red-500`（grep 搜索为空） | 命令行 `grep` |
| 6 | 暗色模式 | `globals.css` 中不存在 `.dark` 选择器 | 文件检查 |
| 7 | 圆角降级 | Card/Dialog 渲染圆角约 6px，Button/Input 约 4px | 浏览器 DevTools 检查 |
| 8 | Focus 效果 | 输入框 focus 仅有 border-color 变化，无 shadow/ring | 浏览器交互验证 |
| 9 | 高度统一 | 所有表单输入框（除表格内）高度为 44px | 浏览器 DevTools 检查 |
| 10 | 状态标签 | 所有页面状态标签统一使用 `StatusBadge` 组件 | 代码审查 |
| 11 | 字体简化 | `layout.tsx` 仅导入 DM Sans 和 Geist_Mono | 文件检查 |
| 12 | 表格行高 | TableCell 纵向 padding 为 12px（py-3），行高约 48-52px | 浏览器 DevTools 检查 |
| 13 | 操作列图标 | 表格操作列无文字，纯图标按钮，带 title 属性 | 代码审查 + 浏览器交互验证 |
| 14 | 分页首页尾页 | Pagination 组件有首页/尾页按钮，可跳转到第 1 页和最后一页 | 浏览器交互验证 |
| 15 | 选择器图标 | SearchableSelect、TileSelect、IngredientPicker 使用 ChevronDown 图标 | 代码审查 |

---

## 八、相关文件参考

### 核心样式文件
- `app/globals.css` — 主题变量定义、focus 规则、.dark 区块
- `app/layout.tsx` — 字体导入、全局布局

### shadcn/ui 组件（需修改）
- `components/ui/button.tsx` — 圆角 `rounded-2xl`、高度
- `components/ui/card.tsx` — 圆角 `rounded-[min(...)]`
- `components/ui/dialog.tsx` — 圆角
- `components/ui/input.tsx` — 高度、focus ring
- `components/ui/badge.tsx` — 圆角
- `components/ui/table.tsx` — 行高 `TableCell` padding
- `components/ui/select.tsx` — 图标（已使用 ChevronDown，保持）

### 自定义组件（需修改）
- `app/components/category-tag.tsx` — 10 种硬编码分类色
- `app/components/form-field.tsx` — `text-red-500`
- `app/components/dish-card.tsx` — 状态标签硬编码色
- `app/components/date-picker.tsx` — 高度 h-11
- `app/components/searchable-select.tsx` — 高度 h-11、图标 `ChevronsUpDown` → `ChevronDown`
- `app/components/tile-select.tsx` — 高度 h-11、图标 `ChevronsUpDown` → `ChevronDown`
- `app/components/ingredient-picker.tsx` — 高度 h-11、检查图标是否替换
- `app/components/dish-create-wizard.tsx` — 多处 `text-red-500`、高度 h-10
- `app/components/pagination.tsx` — 增加首页/尾页按钮
- `app/components/status-badge.tsx` — **新建组件**

### 页面文件（需替换状态标签 + 操作列纯图标）
- `app/purchases/page.tsx` — 内联 `StatusBadge` 函数 + 操作列文字
- `app/purchases/reimbursements/page.tsx` — 同上
- `app/purchases/reimbursements/[id]/page.tsx` — 同上
- `app/schedules/page.tsx` — 内联 `statusColors` + 操作列
- `app/schedules/[id]/page.tsx` — 同上
- `app/dishes/page.tsx` — `dish-card` 中状态标签 + 操作列
- `app/dishes/[id]/page.tsx` — 状态标签
- `app/inventory/page.tsx` — 内联状态标签 + 操作列
- `app/inventory/ledger/page.tsx` — 同上
- `app/settings/users/page.tsx` — 操作列文字
- `app/settings/suppliers/page.tsx` — 操作列文字
- `app/settings/categories/page.tsx` — 操作列文字
- `app/settings/classes/page.tsx` — 操作列文字
- `app/settings/units/page.tsx` — 操作列文字
- `app/ingredients/raw/page.tsx` — 操作列文字
- `app/ingredients/net/page.tsx` — 操作列文字
- `app/ingredients/minor/page.tsx` — 操作列文字
- `app/ingredients/seasoning/page.tsx` — 操作列文字
- `app/ingredients/sauce/page.tsx` — 操作列文字
