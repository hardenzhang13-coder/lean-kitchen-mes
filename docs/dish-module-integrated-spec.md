> 本文档作为 Claude Code 的完整执行需求输入。P0 基础修复（分页/Zod/any/编译）已在独立执行，**不包含在本文档中**。
>
> 当前系统版本：Next.js 16.2.7 + React 19.2.4 + Prisma 7.8.0
> 更新时间：2026-06-27（最新代码扫描后）

---

## 一、当前状态总览

| 需求 | 状态 | 说明 |
|------|------|------|
| 新建/编辑页加载优化（2个请求） | ✅ 已完成 | `app/dishes/new/page.tsx`、`app/dishes/[id]/edit/page.tsx` 已改为只发2个请求 |
| BOM 选择器按需加载 | ✅ 已完成 | `BomPickerDialog` 已实现 `onLoadItems` 异步加载 |
| 已发布菜品下架修复 | ✅ 已完成 | `lib/schemas/dish.ts` 中 `updateDishSchema` 已去掉 `.default()` |
| API 响应格式统一后的前端回归 | ❌ **待修复** | 6 处前端未同步提取 `.data` |

---

## 二、待修复：API 响应格式回归（6处）

P0 修复统一了所有列表 API 的响应格式为 `{success, data, pagination}`。但以下 6 处前端代码仍按旧格式直接 `setState(data)`，导致状态变量被设置为对象而非数组，引发运行时错误。

**修复模式统一：**
```typescript
// 修复前（错误）
.then((data) => setCategories(data))

// 修复后（正确）
.then((res) => setCategories(res.data?.items || res.data || []))
```

说明：分页 API 返回 `data.items`（数组），非分页 API 返回 `data`（直接数组）。兼容写法 `res.data?.items || res.data || []` 同时适配两种情况。

---

### 修复 1：`app/purchases/new/page.tsx:282`

```typescript
// 修复前
fetch("/api/ingredient-categories")
  .then((r) => r.json())
  .then((data) => setCategories(data))

// 修复后
fetch("/api/ingredient-categories")
  .then((r) => r.json())
  .then((res) => setCategories(res.data?.items || res.data || []))
```

---

### 修复 2：`app/purchases/new/page.tsx:286`

```typescript
// 修复前
fetch("/api/units")
  .then((r) => r.json())
  .then((data) => setUnits(data))

// 修复后
fetch("/api/units")
  .then((r) => r.json())
  .then((res) => setUnits(res.data?.items || res.data || []))
```

---

### 修复 3：`app/components/unit-select.tsx:35-39`

```typescript
// 修复前
fetch("/api/units")
  .then((res) => res.json())
  .then((data: Unit[]) => {
    setUnits(data || []);
  })

// 修复后
fetch("/api/units")
  .then((res) => res.json())
  .then((res) => {
    setUnits(res.data?.items || res.data || []);
  })
```

---

### 修复 4：`app/purchases/reimbursements/page.tsx:34-36`

```typescript
// 修复前
const res = await fetch("/api/purchase-reimbursements");
const data = await res.json();
setRows(data);

// 修复后
const res = await fetch("/api/purchase-reimbursements");
const data = await res.json();
setRows(data.data?.items || data.data || []);
```

---

### 修复 5：`app/settings/classes/page.tsx:63-65`

```typescript
// 修复前
const res = await fetch("/api/ingredient-categories");
const json = await res.json();
setData(json);

// 修复后
const res = await fetch("/api/ingredient-categories");
const json = await res.json();
setData(json.data?.items || json.data || []);
```

---

### 修复 6：`app/ingredients/raw/[id]/page.tsx:82`

```typescript
// 修复前
setCategories(await catRes.json());

// 修复后
const catJson = await catRes.json();
setCategories(catJson.data?.items || catJson.data || []);
```

---

## 三、验收标准

| # | 验收项 | 验证方式 |
|---|--------|----------|
| 1 | `npx tsc --noEmit` 通过 | 命令执行 |
| 2 | `npm run build` 成功 | 命令执行 |
| 3 | `npm run lint` 无 errors | 命令执行 |
| 4 | `/purchases/new` 能正常打开，无白屏 | 浏览器 |
| 5 | 新建采购单页面单位下拉有数据 | 浏览器 |
| 6 | `/purchases/reimbursements` 列表有数据 | 浏览器 |
| 7 | `/settings/classes` 分类数据正常展示 | 浏览器 |
| 8 | `/ingredients/raw/1` 编辑页正常加载 | 浏览器 |
| 9 | 已发布菜品可以下架（发布→下架→状态变草稿） | 浏览器 |

---

## 四、直接交付给 CC 的修复指令

```
请修复以下 6 处 API 响应格式统一后的前端回归问题。

修复 1：app/purchases/new/page.tsx:282
.then((data) => setCategories(data))
→ .then((res) => setCategories(res.data?.items || res.data || []))

修复 2：app/purchases/new/page.tsx:286
.then((data) => setUnits(data))
→ .then((res) => setUnits(res.data?.items || res.data || []))

修复 3：app/components/unit-select.tsx:35-39
.then((data: Unit[]) => { setUnits(data || []); })
→ .then((res) => { setUnits(res.data?.items || res.data || []); })

修复 4：app/purchases/reimbursements/page.tsx:34-36
setRows(data);
→ setRows(data.data?.items || data.data || []);

修复 5：app/settings/classes/page.tsx:63-65
setData(json);
→ setData(json.data?.items || json.data || []);

修复 6：app/ingredients/raw/[id]/page.tsx:82
setCategories(await catRes.json());
→ const catJson = await catRes.json(); setCategories(catJson.data?.items || catJson.data || []);

修复后执行：
  npx tsc --noEmit
  npm run build
  npm run lint
```

---

## 五、边界（不涉及的范围）

- ❌ P0 基础修复（分页、Zod 校验、any 类型、编译等）—— 已在独立执行
- ❌ 加载优化（新建/编辑页按需加载、BOM 选择器异步加载）—— 已完成
- ❌ 已发布菜品下架修复（`updateDishSchema`）—— 已完成
- ❌ 不修改数据库 Schema（无需 `prisma migrate dev`）
- ❌ 不修改 Cloudinary 配置（P1 问题）
- ❌ 不修改 Google 字体加载（P1 问题）
- ❌ 不新增采购计划执行页、采购单编辑页等功能（P2 问题）

---

## 六、相关文件参考

| 文件 | 说明 |
|------|------|
| `lib/api-response.ts` | API 响应格式定义（`paginated`、`success`） |
| `lib/schemas/dish.ts` | `updateDishSchema` 已修复（去掉 `.default()`） |
| `app/dishes/new/page.tsx` | 加载优化已完成（只发 2 个请求） |
| `app/components/dish-form/bom-picker-dialog.tsx` | 按需加载已实现 |

---

*文档版本：v2.0 | 2026-06-27 | 基于最新代码扫描，仅含 6 处待修复*
