# 任务 2：统一分页大小为 10 行/页

## 问题概述

`app/lib/use-pagination.ts` 中 `DEFAULT_PAGE_SIZE = 20`，但用户要求所有列表默认展示 10 行。食材库 5 个清单页面均已使用 `usePagination` 和 `DEFAULT_PAGE_SIZE`，只需改一处即可全局生效。

## 根因

`DEFAULT_PAGE_SIZE` 初始设为 20，与用户当前需求（10 行）不一致。虽然 5 个食材页面的 `SkeletonTable` 已正确引用 `DEFAULT_PAGE_SIZE`，但分页组件显示和实际每页数据量仍为 20。

## 修复点

### 修复点：修改 `DEFAULT_PAGE_SIZE`

**文件**：`app/lib/use-pagination.ts`

```ts
// 修改前（第 3 行）
export const DEFAULT_PAGE_SIZE = 20;

// 修改后
export const DEFAULT_PAGE_SIZE = 10;
```

## 影响范围确认

以下文件已使用 `DEFAULT_PAGE_SIZE`，无需额外修改：

| 文件 | 当前使用方式 | 是否需要改 |
|------|-------------|-----------|
| `app/ingredients/raw/page.tsx` | `SkeletonTable cols={13} rows={DEFAULT_PAGE_SIZE}` | ❌ 已引用变量 |
| `app/ingredients/seasoning/page.tsx` | `SkeletonTable cols={10} rows={DEFAULT_PAGE_SIZE}` | ❌ 已引用变量 |
| `app/ingredients/net/page.tsx` | `SkeletonTable cols={11} rows={DEFAULT_PAGE_SIZE}` | ❌ 已引用变量 |
| `app/ingredients/minor/page.tsx` | `SkeletonTable cols={9} rows={DEFAULT_PAGE_SIZE}` | ❌ 已引用变量 |
| `app/ingredients/sauce/page.tsx` | `SkeletonTable cols={9} rows={DEFAULT_PAGE_SIZE}` | ❌ 已引用变量 |

## 验证清单

### 强制检查
1. `npx tsc --noEmit`
2. `npm run build`
3. `npm run lint`

### 功能验证
1. 打开原料清单、调料清单、净料清单、小料清单、酱料清单
2. 每个列表默认加载 10 条数据（分页组件显示 "1-10 / 共 N 条"）
3. 骨架屏加载时也展示 10 行（与分页一致）
4. 搜索关键词后自动回到第 1 页（确认 `useEffect(() => setCurrentPage(1), [search])` 已存在）

## 边界（不涉及）
- 设置模块（categories/classes/units/suppliers/users）无分页，无需修改
- 不修改其他模块的列表页
- 不修改 `Pagination` 组件本身的实现
