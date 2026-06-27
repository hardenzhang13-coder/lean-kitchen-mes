# 菜品模块新建/编辑页面加载性能优化需求文档

> 本文档作为 Claude Code 的独立执行需求输入，聚焦「新建/编辑菜品页面加载缓慢」问题的根治。与 P0 修复并行，但独立交付。
>
> 当前系统版本：Next.js 16.2.7 + React 19.2.4 + Prisma 7.8.0

---

## 一、需求总览

| 编号 | 需求名称 | 类型 | 优先级 | 说明 |
|------|----------|------|--------|------|
| 1 | 减少新建/编辑页面预加载请求 | 性能优化 | P0 | 从 6 个请求减少到 2 个 |
| 2 | BOM 选择器改为按分类懒加载 | 架构重构 | P0 | 默认只加载第一个分类，切换分类时异步加载 |
| 3 | 增加搜索异步加载能力 | 功能增强 | P0 | 输入关键词后调用 API 搜索 |
| 4 | 增强 API 查询参数 | 接口增强 | P0 | 增加 `q` 搜索、`l2Code` 直接过滤 |

---

## 二、详细需求说明

### 需求 1：减少新建/编辑页面预加载请求

#### 现状问题
- **新建页面** (`/dishes/new`) 加载时，`useEffect` 中同时发起 6 个并行请求：
  ```
  1. GET /api/dish-categories
  2. GET /api/ingredient-categories
  3. GET /api/net-ingredients?excludeMinor=true
  4. GET /api/net-ingredients?l1Code=MIN
  5. GET /api/ingredients              ← 返回全部 259 条，最大瓶颈
  6. GET /api/sauce-ingredients
  ```
- **编辑页面** (`/dishes/[id]/edit`) 更夸张，同时发起 7 个请求（比新建页多一个 `GET /api/dishes/:id`）
- 虽然 `Promise.all` 并行，但最慢的请求（`ingredients` 返回 259 条全量数据）决定整体首屏时间

#### 目标业务逻辑
- 页面加载时**只预加载 2 个请求**：
  ```
  1. GET /api/dish-categories
  2. GET /api/ingredient-categories
  ```
- 其余食材数据（原料、净料、小料、调料、酱料）**不再在页面加载时预加载**
- 当用户打开 BOM 选择器弹窗时，按需加载对应分类的数据

#### 涉及范围
- `app/dishes/new/page.tsx` — 修改 `fetchRefs` 中的 `Promise.all`
- `app/dishes/[id]/edit/page.tsx` — 修改 `fetchAll` 中的 `Promise.all`
- `app/components/dish-form/index.tsx` — 修改 `DishFormProps` 的 `refs` 类型，去掉不再预加载的字段

#### 注意事项
- 页面加载时仍需从 `ingredientCategories` 中提取「调味品二级分类 code」（用于调料判断逻辑），这个逻辑保留
- 不要破坏 `DishForm` 组件已有的 props 接口，其他调用方（如详情页）不受影响

---

### 需求 2：BOM 选择器改为按分类懒加载

#### 现状问题
- `BomPickerDialog` 接收 `refs` 对象，包含预加载的全部食材（`netIngredients`、`minorIngredients`、`seasonings`、`sauces`）
- 弹窗打开时，在内存中按分类过滤展示（`useMemo` 过滤 `baseItems`）
- 数据量大了以后，即使内存过滤也会造成明显卡顿

#### 目标业务逻辑
- `BomPickerDialog` 不再接收预加载的食材数组，改为**接收异步加载函数**
- 弹窗打开时，**默认选中第一个一级分类的第一个二级分类**，并立即加载该分类下的食材
- 用户切换分类时，**重新发起 API 请求**加载新分类的食材
- 用户切换一级分类时，**自动选中该分类下的第一个二级分类**并加载

**弹窗内的加载流程：**
```
1. 打开弹窗 → 自动选中 l1Categories[0] → 选中 l1Categories[0].children[0] → 调用 API 加载该二级分类食材
2. 用户点击一级分类 → 自动选中该分类下第一个二级分类 → 调用 API 加载
3. 用户点击二级分类 → 调用 API 加载该分类食材
4. 用户输入搜索词 → 调用 API 搜索（见需求 3）
```

**食材类型与 API 对应关系：**

| BOM 类型 | 对应 API | 查询参数 |
|----------|----------|----------|
| `main` / `support` | `GET /api/net-ingredients` | `l2Code` 或 `l1Code` |
| `minor` | `GET /api/net-ingredients` | `l1Code=MIN` 或 `l2Code` |
| `seasoning` | `GET /api/ingredients` | `l2Code`（调味品二级分类） |
| `sauce` | `GET /api/sauce-ingredients` | 全量（数据量小） |

#### 涉及范围
- `app/components/dish-form/bom-picker-dialog.tsx` — 核心重构
- `app/components/dish-form/bom-editor.tsx` — 修改 `refs` 类型和 `BomPickerDialog` 调用方式
- `app/components/dish-form/index.tsx` — 修改 `DishForm` 的 `refs` 类型
- `app/dishes/new/page.tsx` — 修改 `refs` 构建逻辑
- `app/dishes/[id]/edit/page.tsx` — 修改 `refs` 构建逻辑

#### 弹窗 UI 交互规范

- 一级分类按钮网格：点击后自动选中该分类下的第一个二级分类，同时触发加载
- 二级分类按钮网格：点击后触发加载
- 加载中状态：表格区域显示骨架屏（`SkeletonTable`），分类按钮区域保持可点击
- 空状态：如果该分类下无数据，表格显示"该分类下暂无原料"（已有空状态）
- 错误状态：加载失败时显示 toast 提示，但不关闭弹窗，用户可切换分类重试

#### 数据类型调整

`BomPickerDialog` 的 `refs` 从：
```typescript
interface BomPickerDialogRefs {
  netIngredients: IngredientOption[];
  minorIngredients: IngredientOption[];
  seasonings: IngredientOption[];
  sauces: IngredientOption[];
  ingredientCategories: IngredientCategory[];
}
```

改为：
```typescript
interface BomPickerDialogRefs {
  ingredientCategories: IngredientCategory[];
}

// 新增异步加载函数
interface BomPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: BomType;
  onSelect: (items: Array<{ option: IngredientOption; amountG: string }>) => void;
  refs: { ingredientCategories: IngredientCategory[] };
  onLoadItems: (params: { type: BomType; l1Code?: string; l2Code?: string; q?: string }) => Promise<IngredientOption[]>;
}
```

#### 注意事项
- 弹窗内需要维护 `loading` 状态（按分类级别，不是全局）
- 已选中的食材（`selectedItems`）在切换分类时**不清空**，用户可以在多个分类中跨选
- 切换分类时只重新加载表格数据，不重置已选
- 搜索模式（需求 3）与分类模式互斥：有搜索词时按搜索展示，清空搜索词后恢复分类展示

---

### 需求 3：搜索异步加载

#### 现状问题
- 当前搜索是在内存中过滤（`baseItems.filter(...)`）
- 去掉预加载后，内存中没有数据可供过滤

#### 目标业务逻辑
- 搜索框输入时，**调用 API 异步搜索**
- 防抖：输入停止 300ms 后触发请求
- 最小触发长度：关键词长度 ≥ 2 才触发搜索
- 搜索时不区分分类，搜索全部食材
- 清空搜索词后，恢复当前选中分类的展示

**搜索 API 调用规则：**

| BOM 类型 | 搜索 API | 查询参数 |
|----------|----------|----------|
| `main` / `support` | `GET /api/net-ingredients` | `q={keyword}` |
| `minor` | `GET /api/net-ingredients` | `q={keyword}` |
| `seasoning` | `GET /api/ingredients` | `q={keyword}` |
| `sauce` | `GET /api/sauce-ingredients` | `q={keyword}` |

#### 涉及范围
- `app/components/dish-form/bom-picker-dialog.tsx` — 搜索框 onChange 逻辑

#### 交互规范
- 搜索框有输入时，分类选择区域**灰显**（disabled 或视觉弱化），表示当前在搜索模式
- 搜索加载中显示骨架屏
- 搜索结果为空时显示"暂无匹配原料" + 提示用户调整搜索条件
- 点击"清除搜索"按钮（搜索框右侧的 X 图标）后恢复分类模式

---

### 需求 4：增强 API 查询参数

#### 现状问题
- `/api/ingredients` 目前只支持 `l2Code` 查询（通过 `ingredientQuerySchema`），**不支持搜索**
- `/api/net-ingredients` 支持 `l1Code` 和 `excludeMinor`，但**不支持直接 `l2Code` 查询和搜索**
- `/api/sauce-ingredients` 返回全部数据，**不支持搜索**

#### 目标业务逻辑

**4.1 `/api/ingredients` 增加 `q` 搜索参数**
- `GET /api/ingredients?q={keyword}` — 按名称、编号、别名模糊匹配
- `GET /api/ingredients?l2Code={code}&q={keyword}` — 在指定分类内搜索
- 实现方式：在 `where` 条件中增加 `OR` 查询（`name contains` 或 `code contains` 或 `alias contains`）
- 更新 `lib/schemas/ingredient.ts` 中的 `ingredientQuerySchema`：
  ```typescript
  export const ingredientQuerySchema = z.object({
    l2Code: z.string().optional(),
    q: z.string().optional(),
  });
  ```

**4.2 `/api/net-ingredients` 增加 `l2Code` 和 `q` 参数**
- `GET /api/net-ingredients?l2Code={code}` — 直接按二级分类查询
- `GET /api/net-ingredients?q={keyword}` — 按名称、编号模糊匹配
- `GET /api/net-ingredients?l1Code={code}&q={keyword}` — 组合查询
- 现有 `l1Code` 和 `excludeMinor` 参数保持不变
- 实现逻辑：在 `where` 中增加 `l2Code` 直接过滤，或增加 `name`/`code` 模糊搜索
- 注意：如果同时传了 `l1Code` 和 `l2Code`，优先用 `l2Code`（更精确）

**4.3 `/api/sauce-ingredients` 增加 `q` 参数**
- `GET /api/sauce-ingredients?q={keyword}` — 按名称、编号模糊匹配
- 酱料数据量小，即使有搜索参数也建议直接全量查询 + 内存过滤（性能足够）

#### 涉及范围
- `app/api/ingredients/route.ts` — 修改 GET handler
- `app/api/net-ingredients/route.ts` — 修改 GET handler
- `app/api/sauce-ingredients/route.ts` — 修改 GET handler
- `lib/schemas/ingredient.ts` — 更新 `ingredientQuerySchema`
- 新建 `lib/schemas/net-ingredient.ts` — 定义 `netIngredientQuerySchema`
- 新建 `lib/schemas/sauce-ingredient.ts` — 定义 `sauceIngredientQuerySchema`

---

## 三、数据模型与 API 变更

### 无 Schema 变更
本次优化不涉及数据库模型变更，无需执行 `prisma migrate dev`。

### API 查询参数新增

| API | 新增参数 | 类型 | 说明 |
|-----|----------|------|------|
| `GET /api/ingredients` | `q` | string | 按名称/编号/别名模糊搜索 |
| `GET /api/net-ingredients` | `l2Code` | string | 直接按二级分类过滤 |
| `GET /api/net-ingredients` | `q` | string | 按名称/编号模糊搜索 |
| `GET /api/sauce-ingredients` | `q` | string | 按名称/编号模糊搜索 |

### 前端组件接口变更

| 组件 | 变更 | 说明 |
|------|------|------|
| `DishFormProps.refs` | 去掉 `netIngredients`/`minorIngredients`/`seasonings`/`sauces` | 只保留 `ingredientCategories` |
| `BomPickerDialogProps` | 新增 `onLoadItems` 异步函数 | 替代预加载数据 |
| `BomEditorProps.refs` | 同步调整 | 与 `DishFormProps` 一致 |

---

## 四、交互设计

### 4.1 新建/编辑页面加载流程

```
页面加载 → 发起 2 个请求：
  1. GET /api/dish-categories
  2. GET /api/ingredient-categories
→ 等待响应（预期 < 300ms，因为数据量极小）
→ 渲染表单（基础信息面板 + BOM 编辑器 + 工艺编辑器）
→ 用户可直接开始填写基础信息
```

### 4.2 BOM 选择器弹窗交互流程

```
用户点击「添加主料」→ 打开弹窗 → 自动执行：
  1. 渲染一级分类按钮（从 ingredientCategories 获取，已预加载）
  2. 默认选中第一个一级分类（如「蔬菜」）
  3. 自动选中该分类下的第一个二级分类（如「叶菜」）
  4. 调用 onLoadItems({ type: "main", l2Code: "VEG-LEF" })
  5. 表格显示加载骨架屏 → 显示「叶菜」分类下的食材

用户点击「根茎」二级分类 → 触发：
  1. 调用 onLoadItems({ type: "main", l2Code: "VEG-ROO" })
  2. 表格刷新，显示「根茎」分类下的食材

用户输入「土豆」搜索 → 触发（防抖 300ms）：
  1. 分类按钮区域灰显
  2. 调用 onLoadItems({ type: "main", q: "土豆" })
  3. 表格显示搜索结果

用户点击「清除搜索」→ 恢复分类模式，展示当前选中分类的数据

用户选择食材后点击「确认选择」→ 关闭弹窗，食材加入 BOM 列表
```

### 4.3 加载状态与空状态

| 场景 | 状态展示 | 说明 |
|------|----------|------|
| 分类切换加载中 | 表格区域骨架屏（3 行） | 分类按钮可点击，可切换 |
| 搜索加载中 | 表格区域骨架屏（3 行） | 搜索框显示 loading 图标 |
| 该分类无数据 | 空状态：「该分类下暂无原料」 | 已有组件复用 |
| 搜索无结果 | 空状态：「暂无匹配原料」 | 提示用户调整搜索条件 |
| 加载失败 | toast 提示 + 表格区域重试按钮 | 不关闭弹窗 |

---

## 五、技术约束

- ❌ **不引入新的状态管理库**（如 Redux、Zustand），保持 React `useState`/`useEffect` 模式
- ✅ **复用现有组件**：骨架屏用 `SkeletonTable`，空状态用 `EmptyState`，表格用 `DataTable`
- ✅ **复用现有 API 工具**：`lib/api-response.ts` 的 `success`、`lib/validate.ts` 的 `validateQuery`
- ✅ **Zod 校验**：所有新增 API 参数必须通过 `validateQuery` 校验
- ✅ **类型安全**：新增接口类型必须完整定义，不新增 `any` 类型
- ✅ **代码提交前强制检查**：`npx tsc --noEmit` → `npm run build` → `npm run lint`

---

## 六、验收标准

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 1 | 新建页面加载时间 | 从页面打开到可交互 ≤ 1 秒（当前 3-5 秒） | 浏览器 Network 面板计时 |
| 2 | 编辑页面加载时间 | 从页面打开到可交互 ≤ 1.5 秒（当前 4-6 秒） | 浏览器 Network 面板计时 |
| 3 | 页面加载请求数 | 新建页只发起 2 个预加载请求，编辑页只发起 3 个（+菜品详情） | 浏览器 Network 面板计数 |
| 4 | 弹窗打开即加载 | 打开 BOM 选择器后，默认分类的数据在 500ms 内展示 | 浏览器测试 + 截图 |
| 5 | 分类切换加载 | 切换二级分类后，新数据在 500ms 内展示 | 浏览器测试 |
| 6 | 搜索加载 | 输入关键词后（防抖 300ms），搜索结果在 500ms 内展示 | 浏览器测试 |
| 7 | 搜索模式 UI | 搜索时有分类灰显，清除搜索后恢复分类模式 | 截图验证 |
| 8 | 跨分类多选 | 用户在蔬菜类选 1 个，切换到肉类选 2 个，确认后共 3 个加入 BOM | 功能测试 |
| 9 | API 搜索参数 | `/api/ingredients?q=土豆` 返回名称/编号包含「土豆」的食材 | API 测试（curl/浏览器） |
| 10 | API 分类参数 | `/api/net-ingredients?l2Code=VEG-LEF` 返回该分类下的净料 | API 测试 |
| 11 | 类型检查 | `npx tsc --noEmit` 通过，无新类型错误 | 命令执行 |
| 12 | 构建通过 | `npm run build` 成功 | 命令执行 |
| 13 | 端到端功能 | 完整流程：新建菜品 → 填写基础信息 → 添加主料（分类加载+搜索）→ 添加调料 → 保存草稿 | 浏览器测试 |

---

## 七、边界（不涉及的范围）

以下问题明确排除在本次优化范围之外：

- ❌ 不修改 BOM 编辑器的 UI 布局（表格列、按钮样式、弹窗尺寸保持原样）
- ❌ 不修改菜品列表页 `/dishes`（已在 P0 修复中处理）
- ❌ 不修改菜品详情页 `/dishes/[id]`（当前直接 redirect 到 `/dishes`）
- ❌ 不修改数据库 Schema（无需 `prisma migrate dev`）
- ❌ 不修改 Cloudinary 配置（P1 问题）
- ❌ 不修改 Google 字体加载（P1 问题）
- ❌ 不新增采购计划执行页、采购单编辑页等功能（P2 问题）
- ❌ 不影响 P0 修复中的分页和 Zod 校验工作（并行独立交付）

---

## 八、相关文件参考

### 需要修改的文件

| 文件路径 | 修改内容 | 复杂度 |
|----------|----------|--------|
| `app/dishes/new/page.tsx` | 减少 `Promise.all` 中的请求数，去掉食材全量加载 | 低 |
| `app/dishes/[id]/edit/page.tsx` | 减少 `Promise.all` 中的请求数，去掉食材全量加载 | 低 |
| `app/components/dish-form/index.tsx` | 修改 `DishFormProps` 的 `refs` 类型 | 低 |
| `app/components/dish-form/bom-editor.tsx` | 修改 `refs` 类型，传 `onLoadItems` 给弹窗 | 中 |
| `app/components/dish-form/bom-picker-dialog.tsx` | **核心重构**：去掉预加载数据，增加异步加载、分类懒加载、搜索 | 高 |
| `app/components/dish-form/types.ts` | 修改 `DishFormRefs` 和 `BomPickerDialog` 相关类型 | 低 |
| `app/api/ingredients/route.ts` | 增加 `q` 参数支持 | 低 |
| `app/api/net-ingredients/route.ts` | 增加 `l2Code` 和 `q` 参数支持 | 中 |
| `app/api/sauce-ingredients/route.ts` | 增加 `q` 参数支持 | 低 |
| `lib/schemas/ingredient.ts` | 更新 `ingredientQuerySchema` | 低 |
| `lib/schemas/net-ingredient.ts` | 新建 `netIngredientQuerySchema` | 低 |
| `lib/schemas/sauce-ingredient.ts` | 新建 `sauceIngredientQuerySchema` | 低 |

### 现有可复用组件

| 文件路径 | 复用方式 |
|----------|----------|
| `app/components/data-table.tsx` | 弹窗表格展示 |
| `app/components/skeleton-table.tsx` | 加载骨架屏 |
| `app/components/empty-state.tsx` | 空状态展示 |
| `app/components/category-tag.tsx` | 食材标签展示 |
| `lib/validate.ts` | API 参数校验 |
| `lib/api-response.ts` | API 响应格式 |
| `lib/hooks.ts` | `useDebounce` 用于搜索防抖 |

---

## 九、实现建议（供 CC 参考）

### 推荐的修改顺序

1. **先做 API 层增强**（需求 4）：给 3 个 API 增加 `q`/`l2Code` 参数，验证通过
2. **修改类型定义**（`types.ts`）：调整 `DishFormRefs` 和 `BomPickerDialog` 接口
3. **重构 `BomPickerDialog`**：核心逻辑重写，从预加载改为异步加载
4. **修改 `BomEditor`**：传递 `onLoadItems` 而不是食材数组
5. **修改新建/编辑页面**：去掉全量请求，只保留分类树
6. **验证**：打开新建页面，测试分类切换、搜索、多选确认全流程

### `BomPickerDialog` 核心状态设计（建议）

```typescript
// 弹窗内部状态
const [items, setItems] = useState<IngredientOption[]>([]);
const [loading, setLoading] = useState(false);
const [selectedL1, setSelectedL1] = useState<string>("");
const [selectedL2, setSelectedL2] = useState<string>("");
const [search, setSearch] = useState("");
const [selectedItems, setSelectedItems] = useState<Map<number, IngredientOption>>(new Map());
const [amountG, setAmountG] = useState("100");

// 加载数据
const loadItems = useCallback(async (params: { l2Code?: string; q?: string }) => {
  setLoading(true);
  try {
    const result = await onLoadItems({ type, ...params });
    setItems(result);
  } catch {
    toast.error("加载食材失败");
  } finally {
    setLoading(false);
  }
}, [type, onLoadItems]);

// 打开弹窗时自动加载默认分类
useEffect(() => {
  if (!open) return;
  const firstL1 = l1Categories[0]?.code;
  const firstL2 = l1Categories[0]?.children?.[0]?.code;
  if (firstL1) setSelectedL1(firstL1);
  if (firstL2) {
    setSelectedL2(firstL2);
    loadItems({ l2Code: firstL2 });
  }
}, [open]);

// 搜索防抖
const debouncedSearch = useDebounce(search, 300);
useEffect(() => {
  if (!debouncedSearch.trim() || debouncedSearch.trim().length < 2) {
    // 清空搜索时恢复分类模式
    if (selectedL2) loadItems({ l2Code: selectedL2 });
    return;
  }
  loadItems({ q: debouncedSearch.trim() });
}, [debouncedSearch, selectedL2, loadItems]);
```

### `onLoadItems` 函数实现（在页面层）

```typescript
// 在 new/page.tsx 和 edit/page.tsx 中定义
const handleLoadItems = async (params: {
  type: BomType;
  l1Code?: string;
  l2Code?: string;
  q?: string;
}): Promise<IngredientOption[]> => {
  const { type, l2Code, q } = params;
  const query = new URLSearchParams();
  if (l2Code) query.set("l2Code", l2Code);
  if (q) query.set("q", q);

  let url: string;
  switch (type) {
    case "main":
    case "support":
      url = `/api/net-ingredients?${query.toString()}`;
      break;
    case "minor":
      // minor 净料也走 net-ingredients，但用 l1Code=MIN
      if (!q) query.set("l1Code", "MIN");
      url = `/api/net-ingredients?${query.toString()}`;
      break;
    case "seasoning":
      url = `/api/ingredients?${query.toString()}`;
      break;
    case "sauce":
      url = `/api/sauce-ingredients?${query.toString()}`;
      break;
  }

  const res = await fetch(url);
  const json = await res.json();
  return json.data || json; // 兼容两种返回格式
};
```

---

*文档版本：v1.0 | 2026-06-27 | 独立交付，与 P0 修复并行*
