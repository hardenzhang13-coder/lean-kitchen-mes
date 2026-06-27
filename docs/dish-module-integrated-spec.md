> 本文档作为 Claude Code 的完整执行需求输入，涵盖 2 项独立需求：
> 1. 新建/编辑菜品页面加载性能优化
> 2. 菜品发布下架功能修复
>
> P0 基础修复（分页/Zod/any/编译等）已在独立执行，**不包含在本文档中**。
> 当前系统版本：Next.js 16.2.7 + React 19.2.4 + Prisma 7.8.0

---

## 一、需求总览

| 编号 | 需求名称 | 类型 | 优先级 | 说明 |
|------|----------|------|--------|------|
| 1 | 新建/编辑页面加载性能优化 | 性能优化 | P0 | 从 6-7 个请求减少到 2-3 个 |
| 2 | BOM 选择器按分类懒加载 | 架构重构 | P0 | 默认只加载第一个分类，切换时异步加载 |
| 3 | 搜索异步加载 | 功能增强 | P0 | 输入关键词后调用 API 搜索 |
| 4 | API 查询参数增强 | 接口增强 | P0 | 增加 `q` 搜索、`l2Code` 直接过滤 |
| 5 | 修复已发布菜品下架失败 | 缺陷修复 | P0 | Zod schema 默认值导致下架校验误判 |
| 6 | 发布前校验完整性验证 | 功能验证 | P0 | 确保发布/下架全流程可正常执行 |

---

## 二、需求 1-4：加载优化

### 2.1 核心问题

- 新建页 (`/dishes/new`) 加载时 `useEffect` 中同时发起 6 个请求：
  ```
  GET /api/dish-categories
  GET /api/ingredient-categories
  GET /api/net-ingredients?excludeMinor=true
  GET /api/net-ingredients?l1Code=MIN
  GET /api/ingredients              ← 返回全部 259 条，最大瓶颈
  GET /api/sauce-ingredients
  ```
- 编辑页 (`/dishes/[id]/edit`) 同时发起 7 个请求（比新建页多一个 `GET /api/dishes/:id`）
- BOM 选择器弹窗 (`BomPickerDialog`) 依赖预加载的食材数组，在内存中按分类过滤

### 2.2 核心方案

**页面加载时只预加载 2 个请求：**
```
GET /api/dish-categories
GET /api/ingredient-categories
```

**BOM 选择器弹窗改为按需加载：**
- 打开弹窗 → 自动选中 `l1Categories[0]` → 选中 `l1Categories[0].children[0]` → 调用 `onLoadItems({ type, l2Code })` 加载食材
- 切换一级分类 → 自动选中该分类下第一个二级分类 → 调用 API 加载
- 切换二级分类 → 调用 API 加载
- 搜索模式：输入关键词后防抖 300ms → 调用 `onLoadItems({ type, q })` → 分类按钮区域灰显
- 清空搜索 → 恢复分类模式，展示当前选中分类的数据
- 已选食材在切换分类时不清空，支持跨分类多选

**API 查询参数增强：**

| API | 新增参数 | 说明 |
|-----|----------|------|
| `GET /api/ingredients` | `q` | 按名称/编号/别名模糊搜索 |
| `GET /api/net-ingredients` | `l2Code`, `q` | 直接二级分类过滤 + 搜索 |
| `GET /api/sauce-ingredients` | `q` | 按名称/编号搜索 |

### 2.3 前端组件接口变更

`DishFormProps.refs` 从：
```typescript
interface DishFormRefs {
  categories: { id, code, name }[];
  netIngredients: IngredientOption[];
  minorIngredients: IngredientOption[];
  seasonings: IngredientOption[];
  sauces: IngredientOption[];
  ingredientCategories: IngredientCategory[];
}
```

改为：
```typescript
interface DishFormRefs {
  categories: { id, code, name }[];
  ingredientCategories: IngredientCategory[];
}
```

`BomPickerDialogProps` 新增 `onLoadItems` 异步函数：
```typescript
interface BomPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: BomType;
  onSelect: (items) => void;
  refs: { ingredientCategories: IngredientCategory[] };
  onLoadItems: (params: { type: BomType; l1Code?: string; l2Code?: string; q?: string }) => Promise<IngredientOption[]>;
}
```

### 2.4 弹窗加载状态与交互规范

| 场景 | 状态展示 |
|------|----------|
| 分类切换加载中 | 表格区域骨架屏（3 行），分类按钮可点击 |
| 搜索加载中 | 表格区域骨架屏，搜索框显示 loading 图标 |
| 该分类无数据 | 空状态："该分类下暂无原料" |
| 搜索无结果 | 空状态："暂无匹配原料" + 提示调整搜索条件 |
| 加载失败 | toast 提示 + 表格区域重试按钮，不关闭弹窗 |

### 2.5 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `app/dishes/new/page.tsx` | 减少 `Promise.all` 请求数 |
| `app/dishes/[id]/edit/page.tsx` | 减少 `Promise.all` 请求数 |
| `app/components/dish-form/index.tsx` | 修改 `DishFormProps` 类型 |
| `app/components/dish-form/types.ts` | 修改 `DishFormRefs` 类型 |
| `app/components/dish-form/bom-editor.tsx` | 传 `onLoadItems` 给弹窗 |
| `app/components/dish-form/bom-picker-dialog.tsx` | **核心重构**：异步加载、分类懒加载、搜索 |
| `app/api/ingredients/route.ts` | 增加 `q` 参数支持 |
| `app/api/net-ingredients/route.ts` | 增加 `l2Code` 和 `q` 参数 |
| `app/api/sauce-ingredients/route.ts` | 增加 `q` 参数支持 |
| `lib/schemas/ingredient.ts` | 更新 `ingredientQuerySchema` |
| 新建 `lib/schemas/net-ingredient.ts` | `netIngredientQuerySchema` |
| 新建 `lib/schemas/sauce-ingredient.ts` | `sauceIngredientQuerySchema` |

---

## 四、需求 5：修复已发布菜品下架失败

### 4.1 测试发现

| 测试项 | 结果 | 证据 |
|--------|------|------|
| 草稿 → 发布 | ✅ 正常 | 确认对话框 → 状态变"已发布" → toast"发布成功" → 操作列删除按钮消失 |
| 已发布 → 下架 | ❌ 失败 | 确认对话框弹出 → 点击"确认下架" → 状态不变 → toast"已发布菜品不可修改，请先下架" |
| 已发布菜品详情页 | ✅ 正常 | Sheet 中显示"下架"按钮和编辑按钮 |
| 已发布菜品删除按钮 | ✅ 正常 | 操作列不显示删除按钮 |

### 4.2 根因分析

**问题定位：`lib/schemas/dish.ts` 第 19 行**

```typescript
export const updateDishSchema = createDishSchema.partial().omit({ categoryId: true });
```

`createDishSchema` 定义中包含 `.default()` 字段：
```typescript
portion: z.string().max(50).default("正餐份量"),
season: z.string().max(50).default("四季"),
status: dishStatusSchema.default("draft"),
```

当 `createDishSchema.partial()` 后，这些字段变为可选，但 **`.default()` 仍然生效**。

当 `body = {status: "draft"}` 时，Zod 解析后：
- `status = "draft"` ✅（从 body 获取）
- `portion = "正餐份量"` ❌（默认值，不是 undefined）
- `season = "四季"` ❌（默认值，不是 undefined）

**API 下架校验（`app/api/dishes/[id]/route.ts` 第 77-83 行）：**

```typescript
if (existing?.status === "published") {
  const rest = { name, intro, cuisine, technique, taste, portion, season, meatType, cost };
  const hasOtherChanges = Object.values(rest).some((v) => v !== undefined);
  if (hasOtherChanges || status !== "draft") {
    return badRequest("已发布菜品不可修改，请先下架");
  }
}
```

因为 `portion` 和 `season` 有默认值（不是 undefined），所以 `hasOtherChanges = true`。
条件 `true || "draft" !== "draft"` → `true` → 返回错误！

### 4.3 修复方案

**方案 A（推荐）：修改 `updateDishSchema`，去掉 `.default()`**

```typescript
// lib/schemas/dish.ts
export const updateDishSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  intro: z.string().max(500).optional(),
  cuisine: z.string().max(50).optional(),
  technique: z.string().max(50).optional(),
  taste: z.string().max(50).optional(),
  portion: z.string().max(50).optional(),
  season: z.string().max(50).optional(),
  meatType: z.string().max(50).optional(),
  cost: z.number().nonnegative().optional(),
  status: dishStatusSchema.optional(),
});
```

**方案 B：在 API 下架校验中使用原始 `body` 而非 `validation.data`**

```typescript
if (existing?.status === "published") {
  const { status: requestedStatus, ...rest } = body; // 用原始 body
  if (Object.keys(rest).length > 0 || requestedStatus !== "draft") {
    return badRequest("已发布菜品不可修改，请先下架");
  }
}
```

**推荐方案 A**，因为：
- `updateDishSchema` 作为更新接口的 schema，不应该为未传字段填充默认值
- 默认值在创建时合理，但在更新时会导致未传字段被覆盖为默认值
- 方案 A 更彻底，避免其他场景下的类似问题

### 4.4 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `lib/schemas/dish.ts` | 重写 `updateDishSchema`，去掉 `.default()` |
| `app/api/dishes/[id]/route.ts` | 验证修复后下架校验是否正常工作 |

---

## 五、需求 6：发布下架全流程验证

### 5.1 验证清单

| # | 验证项 | 预期结果 | 验证方式 |
|---|--------|----------|----------|
| 1 | 草稿菜品发布 | 确认对话框 → 状态变"已发布" → toast"发布成功" → 列表页刷新 | 浏览器测试 |
| 2 | 已发布菜品下架 | 确认对话框 → 状态变"草稿" → toast"已下架" → 列表页刷新 | 浏览器测试 |
| 3 | 已发布菜品删除按钮 | 列表页操作列不显示删除按钮 | 截图验证 |
| 4 | 已发布菜品编辑限制 | 编辑页面加载后，已发布菜品只能改状态为草稿 | 浏览器测试 |
| 5 | 已发布菜品 API 修改拦截 | PUT 非 `status: "draft"` 请求返回 400 | API 测试（curl） |
| 6 | 草稿菜品删除 | 确认对话框 → 删除成功 → 列表页刷新 | 浏览器测试 |
| 7 | 已发布菜品删除拦截 | API 返回 400 "已发布菜品不可删除" | API 测试（curl） |

### 5.2 发布前校验

从 `app/dishes/page.tsx` 的 `handlePublish` 函数：
```typescript
const error = validateDishDetailForPublish(dishData);
if (error) { toast.error(error); return; }
```

需要验证：`validateDishDetailForPublish` 的校验规则是否完整：
- 主料不能为空？
- 辅料可以为空？
- 调料不能为空？
- 其他必填字段？

**请在修复后验证发布前校验逻辑的正确性。**

---

## 六、技术约束

- ❌ 不引入新的状态管理库
- ✅ 复用 `useDebounce`（`lib/hooks.ts`）做搜索防抖
- ✅ 复用 `DataTable`/`SkeletonTable`/`EmptyState`/`CategoryTag` 组件
- ✅ Zod 校验：`updateDishSchema` 去掉 `.default()`，保持 `.optional()`
- ✅ 类型安全：不新增 `any` 类型
- ✅ 代码提交前强制检查：`npx tsc --noEmit` → `npm run build` → `npm run lint`

---

## 七、边界（不涉及的范围）

以下问题明确排除：
- ❌ P0 基础修复（分页、Zod 校验、any 类型、编译等）—— 已在独立执行
- ❌ 不修改数据库 Schema（无需 `prisma migrate dev`）
- ❌ 不修改 BOM 编辑器的 UI 布局（表格列、按钮样式、弹窗尺寸保持原样）
- ❌ 不修改菜品列表页 `/dishes` 的现有功能（筛选、搜索、分页已正常工作）
- ❌ 不修改菜品详情页 `/dishes/[id]`（当前直接 redirect 到 `/dishes`）
- ❌ 不修改 Cloudinary 配置（P1 问题）
- ❌ 不修改 Google 字体加载（P1 问题）
- ❌ 不新增采购计划执行页、采购单编辑页等功能（P2 问题）

---

## 八、实现顺序建议（供 CC 参考）

| 阶段 | 任务 | 预估工时 | 验证方式 |
|------|------|----------|----------|
| **阶段 1** | 修复 `updateDishSchema` 去掉 `.default()` | 10 分钟 | curl 测试下架 API |
| **阶段 2** | 浏览器验证发布/下架全流程 | 15 分钟 | WebBridge 截图 |
| **阶段 3** | API 层增强（`q`/`l2Code` 参数） | 1 小时 | curl 测试 API |
| **阶段 4** | 修改 `DishFormProps` 和 `BomPickerDialog` 类型 | 30 分钟 | `tsc --noEmit` |
| **阶段 5** | 重构 `BomPickerDialog` 核心逻辑 | 3-4 小时 | 浏览器测试弹窗 |
| **阶段 6** | 修改新建/编辑页面请求数 | 30 分钟 | 浏览器 Network 面板 |
| **阶段 7** | 验证：加载时间、分类切换、搜索、多选 | 1 小时 | 浏览器端到端测试 |
| **阶段 8** | `tsc --noEmit` → `npm run build` → `npm run lint` | 20 分钟 | 命令执行 |

---

## 九、相关文件参考

### 加载优化相关
- `docs/dish-module-loading-optimization-spec.md` — 完整详细方案
- `app/dishes/new/page.tsx` — 新建页面请求逻辑
- `app/dishes/[id]/edit/page.tsx` — 编辑页面请求逻辑
- `app/components/dish-form/bom-picker-dialog.tsx` — BOM 选择器弹窗（核心重构对象）
- `app/components/dish-form/bom-editor.tsx` — BOM 编辑器
- `app/components/dish-form/types.ts` — 类型定义
- `lib/hooks.ts` — `useDebounce`

### 发布下架修复相关
- `lib/schemas/dish.ts` — `updateDishSchema` 修复对象（第 19 行）
- `app/api/dishes/[id]/route.ts` — 下架校验逻辑（第 77-83 行）
- `app/dishes/page.tsx` — `handlePublish`/`handleUnpublish`/`handleDelete`（第 182-217 行）
- `app/components/dish-sheet-detail.tsx` — Sheet 详情弹窗操作按钮
- `app/components/dish-form/types.ts` — `validateDishDetailForPublish`

---

*文档版本：v1.0 | 2026-06-27 | 整合交付，不含 P0 修复（独立执行）*
