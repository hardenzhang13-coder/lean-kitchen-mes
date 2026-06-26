# 菜品档案模块 — 功能开发 Spec

> 本文档作为 Claude Code 的完整执行需求输入。代码层面的设计与执行由 CC 自主完成。
> 当前版本：Next.js 16 + React 19 + Prisma 7 + PostgreSQL + Tailwind v4 + shadcn/ui v4

---

## 一、需求总览

| 编号 | 需求 | 类型 | 优先级 |
|------|------|------|--------|
| 1 | 列表页改为表格，侧边弹窗详情（占40%） | 重构 | P0 |
| 2 | 创建/编辑改为独立页面，左右分栏4:6 | 重构 | P0 |
| 3 | 状态机简化：废弃 `pending`，`draft`/`published` | 重构 | P0 |
| 4 | BOM 从食材库强制选择，禁止手动输入 | 重构 | P0 |
| 5 | 加工工艺 4 阶段纵向排列 | 重构 | P0 |
| 6 | 列表操作常驻查看+编辑，删除/下架移至详情页 | 优化 | P0 |
| 7 | 成本计算在 blur 后触发 | 优化 | P0 |
| 8 | 平铺选择器：选项≤5时横向一行展示，放不下则独占一行 | 优化 | P0 |
| 9 | 份量精简：单人份量 / 正餐份量 | 优化 | P0 |

---

## 二、详细需求说明

### 需求 1：列表页改为表格 + 侧边弹窗详情

#### 目标业务逻辑
- 废弃原卡片列表，改为 `DataTable` 标准表格组件
- 字段顺序（从左到右）：序号、编号、菜品名称、类别、菜品描述、荤素、成本价、状态、创建时间
- 类别和状态使用浅色 `Badge`（胶囊）展示
- 描述字段超过宽度后用 `…` 截断（`line-clamp-1`）
- 操作按钮常驻：查看 + 编辑。删除操作移至详情页
- 点击行（操作按钮区域除外）打开右侧 `Sheet` 弹窗，占屏幕宽度 40%
- 点击编辑按钮跳转独立编辑页面 `/dishes/[id]/edit`

#### 涉及范围
- `app/dishes/page.tsx` — 完全重写，改为表格布局
- `app/components/dish-card.tsx` — 废弃（不再使用卡片）
- `app/dishes/[id]/page.tsx` — 改为弹窗内容组件（或被 Sheet 引用）
- 新增：弹窗详情展示组件（展示在 Sheet 内）

#### 注意事项
- 表格行高使用系统标准 `h-14`（与原料/净料列表一致）
- 使用 `DataTable` 标准组件（已有）
- 分页默认 20 行/页，使用统一分页组件
- 筛选区：搜索框 + 菜品类别 + 做法 + 状态（草稿/已发布）
- 表格空状态使用 `EmptyState` 组件
- 序号列使用递增序号（非数据库存储的序号）

### 需求 2：创建/编辑改为独立页面，左右分栏 4:6

#### 目标业务逻辑
- 废弃原 `DishCreateWizard` 弹窗组件（5 步向导），改为独立页面
- 新建路由：`/dishes/new`
- 编辑路由：`/dishes/[id]/edit`
- 页面布局：左右分栏，左侧占 40%（约 380-400px），右侧占 60%
- 左侧：基础信息表单（所有字段在一个信息块内）
- 右侧上半：菜品用料（BOM）5 类食材纵向排列
- 右侧下半：加工工艺 4 阶段纵向排列

#### 涉及范围
- `app/dishes/new/page.tsx` — 新建（新文件）
- `app/dishes/[id]/edit/page.tsx` — 编辑（新文件）
- `app/components/dish-create-wizard.tsx` — 废弃（功能迁移到新页面）
- 新增：`app/components/dish-form/` 目录（拆分左侧表单、右侧 BOM、右侧工艺、食材选择弹窗）

#### 页面布局参考
```
┌────────────────────────────────────────────────────────────┐
│  ← 返回列表                          [保存草稿] [发布]     │
├──────────────────────────┬─────────────────────────────────┤
│ 左侧：基础信息（40%）      │ 右侧：菜品用料 + 加工工艺（60%）   │
│  · 名称/类别              │  ┌─ 菜品用料 ──────────────────┐│
│  · 描述                   │  │ 主料/辅料/小料/调料/酱料      ││
│  · 菜系/做法/口味/荤素   │  │ 纵向排列，各区域紧凑卡片      ││
│  · 份量/季节              │  │ 估算成本：¥XX.XX             ││
│                          │  └─────────────────────────────┘│
│                          │  ┌─ 加工工艺 ──────────────────┐│
│                          │  │ 初加工→预处理→上灶→出锅      ││
│                          │  │ 纵向排列，阶段展开/收起       ││
│                          │  └─────────────────────────────┘│
└──────────────────────────┴─────────────────────────────────┘
```

### 需求 3：状态机简化

#### 目标业务逻辑
- 废弃 `pending` 状态，只保留 `draft`（草稿）和 `published`（已发布）
- 列表筛选区只显示「草稿」和「已发布」两个选项
- 新建菜品默认 `draft`
- 已发布菜品不可修改（基本信息、BOM、工艺均不可改），不可删除
- 已发布菜品可以「下架」操作：点击后确认，状态变为 `draft`，BOM 和工艺数据保留
- 下架后菜品回到草稿态，可继续编辑、可删除

#### 涉及范围
- `prisma/schema.prisma` — `Dish.status` 业务上只接受 `draft`/`published`（类型仍为 String，默认值 `"draft"`，业务层校验）
- `lib/schemas/dish.ts` — `dishStatusSchema` 改为 `z.enum(["draft", "published"])`
- `app/api/dishes/route.ts` — 创建时 `status` 默认 `"draft"`，不接受其他值
- `app/api/dishes/[id]/route.ts` — PUT 增加已发布态校验：已发布态只允许 `status` 改为 `draft`（下架），其他字段返回 400；DELETE 增加已发布态校验
- `app/api/dishes/[id]/bom/route.ts` — PUT 增加已发布态校验
- `app/api/dishes/[id]/processes/route.ts` — PUT 增加已发布态校验
- `app/dishes/page.tsx` — 列表操作按钮逻辑：常驻查看+编辑，详情页底部显示删除/下架
- `app/dishes/[id]/edit/page.tsx` — 编辑页顶部：草稿态显示「保存草稿」+「发布」，已发布态显示「下架」

#### 数据迁移
- 当前 `dishes` 表数据量为 0，无需迁移
- 如果有 `pending` 数据，建议归为 `draft`

### 需求 4：BOM 从食材库强制选择

#### 目标业务逻辑
- 废弃 `manualName` 手动输入食材名称功能
- 所有 BOM 食材必须从对应食材表中选择，选择后自动带出单价
- 5 类食材来源：
  - 主料/辅料/小料：从 `net_ingredients` 选择（主料/辅料排除小料分类，小料限定小料分类）
  - 调料：从 `ingredients` 选择（限定调料二级分类）
  - 酱料：从 `sauce_ingredients` 选择
- 选择食材后填入用量（克），blur 后触发成本计算
- 成本计算：单价 × 用量(g) / 1000
- 页面实时显示估算总成本（前端估算），发布时后端精确计算并写入 `dish.cost`
- 酱料区域可空，其他 4 类为发布必填

#### 涉及范围
- `app/components/dish-form/bom-editor.tsx` — BOM 编辑器（新组件）
- `app/components/dish-form/bom-picker-dialog.tsx` — 食材选择弹窗（新组件）
- `app/api/dishes/[id]/bom/route.ts` — 保存 BOM + 计算成本（已有，需确认覆盖 5 类食材）
- `app/components/dish-create-wizard.tsx` — 废弃原 `manualName` 和 `handleManualAdd` 逻辑

#### 食材选择弹窗规范
- 弹窗宽度：`sm:max-w-[960px]`
- 左侧分类区（220px）：一级分类 TileGroup（2 列平铺），默认选中第一个分类值；二级分类跟随联动，默认选中第一个分类值
- 右侧列表区：搜索框 + 列表（编号、名称、食材名称/品牌、规格、单价、单位）
- 底部确认区：已选数量 + 确认按钮
- 点击行选中，高亮显示，确认后关闭弹窗，食材加入对应 BOM 区域，用量默认 100g

#### 已选项展示规范
- 每个区域（主料/辅料/小料/调料/酱料）纵向排列，区域之间紧凑间距
- 已选项行：名称 + 商品名称（小料/调料/酱料显示，主料/辅料不显示）+ 用量 Input(g) + 成本价（blur 后计算）+ 删除按钮
- 空状态：显示「暂无主料」「暂无酱料（可选）」等
- 区域顶部显示区域名称 + 添加按钮
- BOM 卡片顶部显示估算总成本

### 需求 5：加工工艺 4 阶段纵向排列

#### 目标业务逻辑
- 4 个阶段固定：初加工 → 预处理 → 上灶加工 → 出锅成品
- 纵向排列，左侧用虚线连接形成顺序逻辑线
- 点击阶段标题可展开/收起，新创建时全部展开
- 每个阶段内有步骤列表 + 添加步骤按钮
- 编辑某步骤时：该步骤展开为表单，同阶段其他步骤折叠为预览行，其他阶段完全收起（仅保留标题）
- 步骤表单 3 行布局：
  - 第 1 行：对象（从已添加的主料和辅料中选择）+ 动作（Input）
  - 第 2 行：描述（Textarea，独占一行，多行文本）
  - 第 3 行：工具（Input）+ 标准（Input，maxLength=50）
- 步骤预览：编号 + 对象→动作 + 描述（单行截断）+ 编辑/删除/上移/下移按钮
- 步骤对象选择器：展示已添加的主料和辅料名称，使用 TileGroup 或 SelectTileMode

#### 涉及范围
- `app/components/dish-form/process-editor.tsx` — 加工工艺编辑器（新组件，替代原 `ProcessTimeline`）
- `app/api/dishes/[id]/processes/route.ts` — 保存加工工艺（已有，需增加已发布态校验）
- `app/components/process-timeline.tsx` — 废弃（功能迁移到 process-editor）

#### 纵向排列样式参考
```
● ① 初加工
│  1. 鸡胸肉 → 切丁
│     切成 1.5cm 见方的丁，备用
│  2. 花生米 → 油炸
│     低温油炸至金黄
│  [+ 添加步骤]
│
● ② 预处理
│  1. 干辣椒 → 切段
│     去籽切段
│  [+ 添加步骤]
│
● ③ 上灶加工
│  1. 鸡胸肉 → 滑炒
│     热油滑炒变色
│  [+ 添加步骤]
│
● ④ 出锅成品
│  1. 装盘 → 撒葱花
│     摆盘撒葱花
│  [+ 添加步骤]
```

- 阶段编号：圆形 badge，`w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium`，显示①②③④
- 阶段名称：`text-sm font-semibold`
- 阶段之间左侧虚线连接：`border-l border-dashed border-muted-foreground/30 ml-2.5 pl-4`
- 阶段间距：`space-y-4`
- 步骤预览行高：`min-h-[36px] flex items-center gap-2`
- 步骤表单区域：`bg-muted/30 rounded-lg p-4`
- 标准字段右侧字符计数：`text-xs text-muted-foreground`（如「0/50」），超限时 `text-destructive`

### 需求 6：列表操作按钮与详情页操作

#### 目标业务逻辑
- 列表页操作按钮常驻显示，不悬浮：
  - 所有行：「查看」按钮（打开侧边弹窗）+「编辑」按钮（跳转编辑页）
  - 删除和下架操作移至详情页底部
- 侧边弹窗详情（占屏幕 40%）底部操作：
  - 草稿态：「删除」按钮（确认 Modal 后删除）
  - 已发布态：「下架」按钮（确认 Modal 后下架为草稿）
- 弹窗内容：基础信息 + BOM 汇总 + 工艺预览
- 弹窗顶部有关闭按钮

#### 涉及范围
- `app/dishes/page.tsx` — 表格操作列改为查看+编辑
- 新增：弹窗详情组件（`DishDetailSheet` 或类似）
- 弹窗组件使用 `Sheet`（shadcn/ui）

### 需求 7：成本计算在 blur 后触发

#### 目标业务逻辑
- 用量输入框（Input）在 `onBlur` 事件时触发成本计算
- 前端估算成本 = 单价 × 用量(g) / 1000
- 修改用量后，该 BOM 项的成本价实时更新
- 总估算成本在 BOM 区域顶部实时更新
- 发布时后端精确计算：`prisma.$transaction` 中汇总所有 BOM 项成本，写入 `dish.cost`
- 计算务必准确：单价和用量均为数值，注意单位换算（g → 1000g 为单价单位）

#### 涉及范围
- `app/components/dish-form/bom-editor.tsx` — 用量 Input 的 `onBlur` 事件
- `app/api/dishes/[id]/bom/route.ts` — 后端精确计算成本（已有实现，需确认）

### 需求 8：平铺选择器规则

#### 目标业务逻辑
- 基础信息中的选择字段（份量、荤素类型等）选项 ≤ 5 时，使用 `TileGroup` 横向平铺展示
- 平铺选项必须展示在一行内
- 如果一行展示不完整（超出容器宽度），则该字段独占一行（`col-span-2`）展示
- 选项字号比字段标签小两级（如标签 `text-sm`，选项 `text-xs`）
- 选项 > 5 时，使用 `SelectTileMode` 弹窗选择

#### 适用字段
- 份量：2 选项（单人份量 / 正餐份量）→ TileGroup 平铺
- 荤素类型：3 选项（荤菜 / 素菜 / 小荤菜）→ TileGroup 平铺
- 类别：取决于 `dish_categories` 数量，如果 > 5 用 SelectTileMode
- 菜系：9 选项 → SelectTileMode
- 做法：14 选项 → SelectTileMode
- 口味：12 选项 → SelectTileMode
- 季节：5 选项 → TileGroup 平铺（测试一行是否放得下，放不下则独占一行）

#### 涉及范围
- `app/components/dish-form/basic-info-panel.tsx` — 基础信息表单
- 使用 `TileGroup` 和 `SelectTileMode` 标准组件（已有）

### 需求 9：份量精简

#### 目标业务逻辑
- 份量选项从 4 个（正餐份量 / 小份 / 大份 / 例份）精简为 2 个：单人份量 / 正餐份量
- 前端选项限制为 2 个，后端仍为字符串存储，不做枚举限制
- 默认值：正餐份量

#### 涉及范围
- `app/components/dish-form/basic-info-panel.tsx` — 份量字段选项
- `lib/schemas/dish.ts` — 默认值 `"正餐份量"`（已有）

---

## 三、数据模型变更

### 1. `Dish` 模型（无 Schema 字段变更，业务逻辑变更）

| 字段 | 当前 | 变更 | 说明 |
|------|------|------|------|
| `status` | `String` 默认 `"draft"` | 保持 | 业务逻辑只接受 `"draft"`/`"published"` |
| `portion` | `String` 默认 `"正餐份量"` | 保持 | 前端选项只剩 2 个 |

### 2. `DishProcess` 模型（无变更）

`stage` 字段使用 `String`，后端 `VALID_STAGES` 校验。已正确。

### 3. BOM 关联表（无 Schema 变更）

5 张 BOM 表（`dish_ingredient_details` / `dish_net_details` / `dish_minor_details` / `dish_seasoning_details` / `dish_sauce_details`）已有，确认外键和字段覆盖本次需求。

### 4. 废弃组件/路由

| 组件/路由 | 动作 | 原因 |
|-----------|------|------|
| `app/components/dish-create-wizard.tsx` | 废弃 | 功能迁移到独立页面 |
| `app/components/dish-card.tsx` | 废弃 | 列表改为表格 |
| `app/components/process-timeline.tsx` | 废弃 | 功能迁移到 process-editor |

---

## 四、API 接口变更

### 1. `GET /api/dishes`

**无变更**。查询参数 `status` 的值现在只能是 `"draft"`/`"published"`。前端筛选选项移除 `pending`。

### 2. `POST /api/dishes`

**无变更**。创建时 `status` 默认 `"draft"`，`createDishSchema` 中 `status` 默认值 `"draft"`（已有）。

### 3. `PUT /api/dishes/[id]`

**新增校验**：在 `prisma.dish.update` 之前增加：
```typescript
const existing = await prisma.dish.findUnique({ where: { id: Number(id) }, select: { status: true } });
if (existing?.status === "published") {
  // 只允许 status 改为 "draft"（下架），其他字段拒绝
  const body = await req.json();
  if (body.status !== "draft") {
    return badRequest("已发布菜品不可修改，请先下架");
  }
}
```

### 4. `DELETE /api/dishes/[id]`

**新增校验**：在 `prisma.dish.delete` 之前增加：
```typescript
const existing = await prisma.dish.findUnique({ where: { id: Number(id) }, select: { status: true } });
if (existing?.status === "published") {
  return badRequest("已发布菜品不可删除");
}
```

### 5. `PUT /api/dishes/[id]/bom`

**新增校验**：在 transaction 开始之前增加同上校验（已发布态拒绝修改）。

### 6. `PUT /api/dishes/[id]/processes`

**新增校验**：在 transaction 开始之前增加同上校验（已发布态拒绝修改）。

---

## 五、交互设计与页面规范

### 5.1 列表页 `/dishes`

#### 表格字段

| 列 | 宽度 | 对齐 | 样式 | 说明 |
|----|------|------|------|------|
| 序号 | 60px | 左 | `text-xs text-muted-foreground` | 递增序号 |
| 编号 | 90px | 左 | `text-xs text-muted-foreground font-mono` | 如 `D-001` |
| 菜品名称 | flex | 左 | `text-sm font-medium` | 可点击打开弹窗 |
| 类别 | 80px | 左 | `Badge variant="secondary"` | 浅色胶囊 |
| 菜品描述 | 200px | 左 | `text-xs text-muted-foreground line-clamp-1` | 单行截断 |
| 荤素 | 60px | 左 | `Badge variant="outline"` | 小胶囊 |
| 成本价 | 80px | 右 | `text-sm font-medium` | 保留 2 位小数 |
| 状态 | 80px | 左 | `StatusBadge` | 草稿=neutral，已发布=success |
| 创建时间 | 110px | 左 | `text-xs text-muted-foreground` | `YYYY-MM-DD` |
| 操作 | 100px | 右 | 按钮组 | 查看+编辑 |

#### 操作按钮
- 常驻显示（`opacity-100`），不悬浮隐藏
- 查看：Eye icon，`variant="ghost" size="icon" className="h-7 w-7"`，点击打开弹窗
- 编辑：Pencil icon，`variant="ghost" size="icon" className="h-7 w-7"`，点击跳转 `/dishes/[id]/edit`
- 点击操作按钮阻止事件冒泡（`e.stopPropagation()`）

#### 筛选区
- 搜索框（Input，`placeholder="搜索"`）
- 菜品类别下拉（SelectTileMode）
- 做法下拉（SelectTileMode）
- 状态下拉（TileGroup：草稿/已发布）

### 5.2 侧边弹窗详情（Sheet）

- 宽度：`w-[40%]`（或 `sm:max-w-[40vw]`）
- 从右侧滑出，使用 `Sheet` 组件（shadcn/ui）
- 点击列表行（操作按钮区域除外）打开
- 弹窗内容：
  1. **头部**：关闭按钮(X) + 菜品名称 + 状态 Badge
  2. **基础信息块**：编号、类别、菜系、做法、口味、份量、季节、荤素、描述（使用 `Card` 或纯文本展示）
  3. **BOM 汇总块**：主料/辅料/小料/调料/酱料 各显示数量（如「主料 3 项」）+ 总成本
  4. **工艺预览块**：4 阶段各显示步骤数量（如「初加工 2 步」）
- 底部操作按钮：
  - 草稿态：「删除」按钮（`Trash2` icon，destructive），点击确认 Modal
  - 已发布态：「下架」按钮（`RotateCcw` icon），点击确认 Modal
- 弹窗关闭：点击遮罩或关闭按钮

### 5.3 创建/编辑页 `/dishes/new` & `/dishes/[id]/edit`

#### 页面布局

```
┌────────────────────────────────────────────────────────────┐
│  ← 返回列表                          [保存草稿] [发布]     │
├──────────────────────────┬─────────────────────────────────┤
│ 左侧：基础信息（40%）      │ 右侧：菜品用料 + 加工工艺（60%）  │
│  ┌────────────────────┐  │  ┌─ 菜品用料 ──────────────────┐│
│  │ 基础信息            │  │  │ 估算成本：¥XX.XX             ││
│  │  · 名称/类别       │  │  │ 主料/辅料/小料/调料/酱料     ││
│  │  · 描述            │  │  │ 纵向排列，各区域紧凑卡片      ││
│  │  · 菜系/做法       │  │  └─────────────────────────────┘│
│  │  · 口味/荤素       │  │  ┌─ 加工工艺 ──────────────────┐│
│  │  · 份量/季节       │  │  │ 初加工→预处理→上灶→出锅     ││
│  └────────────────────┘  │  │ 纵向排列，阶段展开/收起       ││
│                          │  └─────────────────────────────┘│
└──────────────────────────┴─────────────────────────────────┘
```

#### 左侧：基础信息（40%）

- 固定宽度，可滚动（`overflow-y-auto`）
- 使用 `FormSection` 组件，标题「基础信息」
- 字段排列（`grid-cols-2 gap-4`）：
  - 第 1 行：名称（Input）+ 类别（选择器）
  - 第 2 行（占满）：描述（Textarea，`rows=3`）
  - 第 3 行：菜系（选择器）+ 做法（选择器）
  - 第 4 行：口味（选择器）+ 荤素类型（选择器）
  - 第 5 行：份量（TileGroup）+ 季节（选择器）
- 字号：Label `text-sm`，Input `text-sm`，placeholder `text-xs`
- placeholder 超 5 字统一为「请选择」或「请输入」
- 平铺选择器：选项 `text-xs`，比 Label 小两级
- 必填标记：`text-destructive` 红色 `*`

#### 右侧上半：菜品用料（BOM）

- 使用 `Card` 容器，标题行「菜品用料」+ 右侧估算成本
- 5 个区域纵向排列（`space-y-3`），每个区域紧凑卡片（`rounded-lg border p-3`）
- 区域标题行：`flex items-center justify-between`，标题 `text-sm font-semibold` + 添加按钮
- 已选项行：`flex items-center gap-2 rounded-md border p-2 min-h-[40px]`
  - 名称：`flex-1 text-sm font-medium truncate`
  - 商品名称（小料/调料/酱料）：`text-xs text-muted-foreground`
  - 用量：Input `w-[70px] h-8 text-sm px-2`，单位 `g`（`text-xs text-muted-foreground`）
  - 成本价：`text-xs text-muted-foreground w-[60px] text-right`
  - 删除：X icon，`variant="ghost" size="icon" className="h-7 w-7 text-destructive"`
- 空状态：`text-xs text-muted-foreground py-1`
- 添加按钮：`Plus` icon，`variant="outline" size="sm" className="h-8 text-xs"`
- 估算成本：BOM 卡片顶部右侧，`text-sm text-muted-foreground`，数字 `font-medium text-foreground`

#### 右侧下半：加工工艺

- 使用 `Card` 容器，标题「加工工艺」
- 4 阶段纵向排列（`space-y-4`）
- 阶段标题：`flex items-center gap-2`，编号 badge + 名称 `text-sm font-semibold`
- 阶段之间左侧虚线：`border-l border-dashed border-muted-foreground/30 ml-2.5 pl-4`
- 步骤列表（`space-y-2`）
- 添加步骤按钮：`Plus` icon，`variant="outline" size="sm" className="h-8 text-xs"`
- 步骤预览行：`min-h-[36px] flex items-center gap-2`
- 步骤表单：`bg-muted/30 rounded-lg p-4 space-y-4`
- 标准字段字符计数：`text-xs text-muted-foreground`（超限时 `text-destructive`）

#### 页面顶部操作栏

- 左侧：返回按钮（`ArrowLeft` + "返回列表"），`variant="ghost" size="sm"`
- 右侧按钮组（`gap-2`）：
  - 「保存草稿」：`variant="outline" className="h-10"`
  - 「发布」：`variant="default" className="h-10"`
  - 编辑态已发布时：「下架」按钮替代「发布」
- 按钮高度：`h-10`，文字 `text-sm`

### 5.4 食材选择弹窗（BOM 添加）

- `DialogContent`：`sm:max-w-[960px]`
- 左侧分类区（220px）：
  - 一级分类 TileGroup（`grid-cols-2`），默认选中第一个
  - 二级分类 TileGroup（`grid-cols-2`），跟随一级，默认选中第一个
  - 分类按钮高度 `h-9`，字号 `text-xs`
- 右侧列表区：
  - 搜索框：`placeholder="搜索"`，`h-10 text-sm px-3`
  - 表头：编号 | 名称 | 食材名称/品牌 | 规格 | 单价 | 单位
  - 行高 `h-10`，hover `bg-muted/50`
  - 点击行选中，高亮 `bg-primary/10`
- 底部确认区：`sticky bottom-0 bg-background border-t p-3`
  - 左侧：已选数量（`text-sm text-muted-foreground`）
  - 右侧：「确认」按钮（未选择时 disabled）

---

## 六、技术约束与红线

- 禁止新增 `any` 类型
- 禁止无分页的列表 API（列表页必须分页）
- 所有输入校验（Zod schema 或手动）
- 操作日志（`logOperation`）
- BOM 保存和成本计算在 `prisma.$transaction` 中
- Schema 迁移用 `prisma migrate dev`，禁止 `db push`
- 代码提交前检查：`npx tsc --noEmit` → `npm run build` → `npm run lint`
- 使用系统标准组件：`DataTable`, `PageHeader`, `FormSection`, `FormField`, `TileGroup`, `SelectTileMode`, `StatusBadge`, `EmptyState`, `SkeletonTable`, `Sheet`, `Dialog`, `Button`, `Input`, `Textarea`, `Label`, `Badge`
- 不硬编码颜色，使用 CSS 变量：`bg-background`, `text-foreground`, `text-muted-foreground`, `text-primary`, `text-destructive`, `bg-muted`, `border-input`

---

## 七、验收标准

| # | 验收项 | 验收标准 | 验证方式 |
|---|--------|----------|----------|
| 1 | 列表为表格 | 字段顺序：序号、编号、名称、类别、描述、荤素、成本价、状态、创建时间 | 浏览器 |
| 2 | 类别和状态为胶囊 | 类别和状态列使用 `Badge` 展示 | 浏览器 |
| 3 | 描述截断 | 描述超过宽度用 `…` 截断 | 浏览器 |
| 4 | 操作按钮常驻 | 查看+编辑常驻显示，不悬浮 | 浏览器 |
| 5 | 点击行打开弹窗 | 右侧滑出 Sheet，占 40% | 浏览器 |
| 6 | 弹窗底部操作 | 草稿态显示删除，已发布态显示下架 | 浏览器 |
| 7 | 新建页面布局 | 左右分栏 4:6，左侧基础信息，右侧上 BOM 下工艺 | 浏览器 |
| 8 | 左侧字号降级 | Label `text-sm`，Input `text-sm`，placeholder `text-xs` | 浏览器 |
| 9 | placeholder 规则 | 超 5 字统一为「请选择」或「请输入」 | 浏览器 |
| 10 | 平铺选择器 | 选项 ≤ 5 时 TileGroup 平铺，选项 `text-xs` | 浏览器 |
| 11 | 平铺一行展示 | 平铺选项必须在一行内，放不下则该字段独占一行 | 浏览器（调整窗口） |
| 12 | 描述并入基础块 | 描述不单独成 FormSection，在基础信息块内 | 浏览器 |
| 13 | BOM 纵向排列 | 5 类食材纵向堆叠，非 Tab | 浏览器 |
| 14 | 食材强制选择 | 添加主料时弹窗显示食材列表，禁止手动输入 | 浏览器 |
| 15 | 选择弹窗 960px | 弹窗宽度正确，分类默认选中第一项 | 浏览器 |
| 16 | 已选项回显 | 名称+商品名(小料/调料/酱料)+用量(g)+成本价 | 浏览器 |
| 17 | 主料辅料无商品名 | 主料和辅料已选项不显示商品名称 | 浏览器 |
| 18 | 成本 blur 计算 | 修改用量后 blur 触发成本计算，显示正确 | 浏览器 |
| 19 | 估算成本准确 | 估算成本 = 单价×用量/1000，与后端一致 | 浏览器+数据库 |
| 20 | 酱料可选 | 不添加酱料，其他必填项填完，可发布 | 浏览器 |
| 21 | 加工工艺纵向 | 4 阶段纵向排列，左侧有虚线连接 | 浏览器 |
| 22 | 阶段展开收起 | 点击阶段标题切换展开/收起 | 浏览器 |
| 23 | 编辑步骤折叠 | 编辑某步骤时，其他步骤折叠，其他阶段收起 | 浏览器 |
| 24 | 步骤表单 3 行 | 对象+动作 / 描述 / 工具+标准 | 浏览器 |
| 25 | 对象从主料辅料选 | 步骤对象选择器展示已添加主料辅料名称 | 浏览器 |
| 26 | 标准 50 字 | 标准字段 maxLength=50，右侧显示字符计数 | 浏览器 |
| 27 | 发布校验 | 不填主料直接发布，提示"主料不能为空" | 浏览器 |
| 28 | 已发布可下架 | 发布成功后弹窗显示下架按钮，下架后变草稿 | 浏览器 |
| 29 | 已发布不可删除 | 删除 API 返回 400 | 网络面板 |
| 30 | 下架后可编辑 | 下架后编辑按钮可用，可修改基本信息 | 浏览器 |
| 31 | 份量两选项 | 份量只有「单人份量」「正餐份量」 | 浏览器 |
| 32 | 构建通过 | `tsc --noEmit` + `build` + `lint` 全通过 | 命令行 |

---

## 八、相关文件参考

| 文件 | 当前功能 | 变更范围 |
|------|----------|----------|
| `prisma/schema.prisma` | Dish/DishProcess 模型 | 无 Schema 变更（业务逻辑变更） |
| `lib/schemas/dish.ts` | dishStatusSchema | 改为 `z.enum(["draft", "published"])` |
| `app/api/dishes/route.ts` | 菜品列表/创建 API | 状态筛选只接受 draft/published |
| `app/api/dishes/[id]/route.ts` | 单条查询/更新/删除 | 增加已发布态校验 |
| `app/api/dishes/[id]/bom/route.ts` | BOM 保存 + 成本计算 | 增加已发布态校验，确认成本计算覆盖 5 类 |
| `app/api/dishes/[id]/processes/route.ts` | 加工工艺保存 | 增加已发布态校验 |
| `app/dishes/page.tsx` | 卡片列表 | 重写为表格 |
| `app/dishes/new/page.tsx` | — | 新建页面（新文件） |
| `app/dishes/[id]/edit/page.tsx` | — | 编辑页面（新文件） |
| `app/components/dish-create-wizard.tsx` | 5 步弹窗向导 | 废弃 |
| `app/components/dish-card.tsx` | 卡片组件 | 废弃 |
| `app/components/process-timeline.tsx` | 时间线组件 | 废弃 |
| `app/components/dish-form/` | — | 新组件目录（左侧表单/BOM/工艺/选择弹窗） |
| `app/components/data-table.tsx` | 表格组件 | 直接使用 |
| `app/components/page-header.tsx` | 页面头部 | 直接使用 |
| `app/components/status-badge.tsx` | 状态 badge | 直接使用 |
| `app/components/form-field.tsx` | 表单字段 | 直接使用 |
| `app/components/tile-group.tsx` | 平铺选择器 | 直接使用 |
| `app/components/select-tile-mode.tsx` | 弹窗选择器 | 直接使用 |
| `app/components/empty-state.tsx` | 空状态 | 直接使用 |
| `app/components/skeleton-table.tsx` | 骨架屏 | 直接使用 |

---

## 九、边界（不涉及）

- 不修改食材库任何模块（原料/净料/小料/调料/酱料）
- 不修改排程/采购/库存/工作台模块
- 不修改 `app/components/` 下已有标准组件的结构（`DataTable`, `PageHeader`, `StatusBadge`, `FormField`, `TileGroup`, `SelectTileMode` 等）
- 加工工艺字典管理（设置模块）—— 挂起
- 菜品批量导入/导出 —— 挂起
- 菜品图片上传 —— 挂起
- 菜品版本历史 —— 挂起
- 离开页面未保存提示 —— 挂起

---

*文档结束*
