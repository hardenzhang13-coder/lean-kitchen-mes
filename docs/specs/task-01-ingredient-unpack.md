# 任务 1：修复食材库运行时错误 — 数据响应解包

## 问题概述

`GET /api/ingredients` 已被迁移到 `lib/api-response.ts` 的 `success(rows)` 新格式（返回 `{ success: true, data: [...] }`），但其余食材 API（`net-ingredients`、`minor-ingredients`、`sauce-ingredients`、`seasoning-ingredients`）仍返回旧格式（直接数组）。

前端有两处代码直接从 `res.json()` 结果调用 `.map()`，当结果为新格式对象时白屏报错。

## 根因

- `app/components/ingredient-form-dialog.tsx` 第 184-191 行：`fetch` 右侧列表后 `setRightList(await res.json())`，如果 `res.json()` 是 `{ success: true, data: [...] }`，则 `rightList` 变成对象，后续 `.map()` 报错
- `app/ingredients/net/page.tsx` 第 119-120 行：`setRawIngredients(await rawRes.json())`，如果 `rawRes.json()` 是 `{ success: true, data: [...] }`，则 `rawIngredients` 变成对象，`TileSelect` 构建 `options` 时 `map` 报错

## 修复点

### 修复点 A：IngredientFormDialog 右侧列表

**文件**：`app/components/ingredient-form-dialog.tsx`（约 184-191 行）

```ts
// 修改前
const res = await fetch(url);
if (res.ok) setRightList(await res.json());

// 修改后
const res = await fetch(url);
if (res.ok) {
  const json = await res.json();
  setRightList(Array.isArray(json) ? json : json.data || []);
}
```

### 修复点 B：net 页面来源原料

**文件**：`app/ingredients/net/page.tsx`（约 119-120 行）

```ts
// 修改前
setRawIngredients(await rawRes.json());

// 修改后
const rawJson = await rawRes.json();
setRawIngredients(Array.isArray(rawJson) ? rawJson : rawJson.data || []);
```

## 验证清单

### 强制检查
1. `npx tsc --noEmit`
2. `npm run build`
3. `npm run lint`

### 功能验证
1. 打开原料清单 → 新增食材 → 选择"速冻食品"二级分类 → 右侧"已存在食材"列表正常加载，控制台无报错
2. 打开净料清单 → 新增净料 → 来源原料 `TileSelect` 正常加载，可选择

## 参考代码
- `app/ingredients/raw/page.tsx`：已正确解包 `ingData.data || []`
- `app/api/ingredients/route.ts`：GET 返回 `success(rows)` 新格式
- `app/api/net-ingredients/route.ts`：GET 返回 `NextResponse.json(rows)` 旧格式

## 边界（不涉及）
- 不迁移其他食材 API 的响应格式
- 不修改数据库 schema
- 不修改新增食材弹窗的其他逻辑
