# 精益厨房 V3 P0 修复需求文档

> 本文档作为 Claude Code 的完整执行需求输入，涵盖 4 项 P0 级致命缺陷修复。请按本文档描述的业务逻辑、交互规范、数据变更要求执行实现，代码层面的设计与执行由 CC 的 plan 模式自主完成。
>
> 当前系统版本：Next.js 16.2.7 + React 19.2.4 + Prisma 7.8.0 + Tailwind CSS v4
> 审查日期：2026-06-27
> 对应审查报告：`docs/pre-release-audit-report.md`

---

## 一、需求总览

| 编号 | 需求名称 | 类型 | 优先级 | 说明 |
|------|----------|------|--------|------|
| P0-1 | 修复菜品页面变量名错误 | 缺陷修复 | P0 | `currentPage` 未定义导致翻页时运行时崩溃 |
| P0-2 | 为列表 API 补充分页 | 功能补全 | P0 | 12 个 API 违反"禁止无分页列表 API"红线 |
| P0-3 | 为核心 API 补充 Zod 输入校验 | 安全加固 | P0 | 大量 API 直接解析 req.json() 无校验 |
| P0-4 | 消除 any 类型与 ESLint 错误 | 代码质量 | P0 | 违反"禁止新增 any 类型"红线 + 1 个 ESLint error |

---

## 二、详细需求说明

### 需求 P0-1：修复菜品页面变量名错误

#### 现状问题
- `app/dishes/page.tsx` 中定义了状态变量 `page`（第 91 行）和 `setPage`
- 但代码中有多处引用 `currentPage`（第 319 行）和 `setCurrentPage`（隐含在 `pagination` 对象中，第 418 行）
- 在 TypeScript 编译层面报错：`error TS2304: Cannot find name 'currentPage'`
- 在 JavaScript 运行时层面，如果触发到使用 `currentPage` 的渲染路径（如序号列渲染），会抛出 `ReferenceError` 导致页面白屏

#### 目标业务逻辑
- 将 `currentPage` 的所有引用统一改为 `page`
- 将 `setCurrentPage` 的所有引用统一改为 `setPage`
- 确保 TypeScript 编译通过（`npx tsc --noEmit`）

#### 涉及范围
- 文件：`app/dishes/page.tsx`
- 影响：仅菜品列表页，不影响其他页面或 API

#### 注意事项
- 检查 `pagination` 对象是否也使用了 `currentPage` 作为属性名（如果存在，改为 `page`）
- 不要引入新的变量或重命名方案，只做对齐修复
- 修复后页面功能应保持完全一致

---

### 需求 P0-2：为列表 API 补充分页

#### 现状问题
- 当前仅 `/api/dishes` 和 `/api/purchase-receipts` 实现了分页（`skip`/`take`）
- 其余 12 个列表 API 使用 `findMany` 返回全部数据，无分页参数
- 违反项目 AGENTS.md 红线："禁止新增无分页的列表 API"
- 随着数据量增长（特别是采购单、台账、排程），这些 API 会导致严重的性能问题和前端渲染卡顿

#### 目标业务逻辑
为以下 12 个 API 的 GET 方法统一补充分页支持：

| # | API 路由 | 数据量风险 |
|---|----------|------------|
| 1 | `GET /api/ingredients` | 高（已录入大量食材） |
| 2 | `GET /api/net-ingredients` | 中 |
| 3 | `GET /api/sauce-ingredients` | 低 |
| 4 | `GET /api/schedules` | 高（随时间积累） |
| 5 | `GET /api/inventory` | 中 |
| 6 | `GET /api/inventory/ledger` | 高（流水量极大） |
| 7 | `GET /api/purchase-reimbursements` | 中 |
| 8 | `GET /api/dish-categories` | 低（数据量小） |
| 9 | `GET /api/ingredient-categories` | 低（数据量小） |
| 10 | `GET /api/suppliers` | 低（数据量小） |
| 11 | `GET /api/units` | 低（数据量小） |
| 12 | `GET /api/users` | 低（数据量小） |

分页参数规范：
- 查询参数：`page`（页码，从 1 开始，默认 1）、`pageSize`（每页条数，默认 20，最大 100）
- 计算 `skip = (page - 1) * pageSize`，`take = pageSize`
- 同时返回 `totalItems` 和 `totalPages`（或 `count` 查询）
- 响应格式统一为：`{ code: 200, data: { items: [], pagination: { totalItems, totalPages, currentPage, pageSize } } }`

对于数据量小的 API（分类、单位、供应商、用户），分页支持仍需保留接口，但前端可默认请求大页码（如 pageSize=100）以减少请求次数。

#### 涉及范围
- 12 个 API 路由文件的 GET handler
- 对应前端页面中的列表组件（检查是否使用 `DataTable` 或类似分页组件，需要接入分页参数）
- 注意：部分页面可能使用 `usePagination` hook（位于 `app/lib/use-pagination.ts`），优先复用

#### 注意事项
- 分页参数需做输入校验（page ≥ 1，pageSize ≥ 1 且 ≤ 100）
- 排序逻辑保持不变（`orderBy: { createdAt: "desc" }` 或现有排序）
- 已有的 `where` 条件过滤（如 `deletedAt: null`）应保留并与分页共存
- 不要破坏前端现有分页组件的接口约定（如果前端已经有分页组件，API 响应格式需与其匹配）

---

### 需求 P0-3：为核心 API 补充 Zod 输入校验

#### 现状问题
- 40 个 API 路由中，仅 `auth/login` 和 `ingredients` 使用了 Zod 校验（通过 `lib/validate.ts` 的 `validateBody`/`validateQuery`）
- 其余 API 大量使用 `const body = await req.json()` 直接解析，无任何校验
- 存在数据类型不匹配、缺少必填字段、恶意注入等风险

#### 目标业务逻辑
为所有涉及数据写入的 API 补充 Zod 输入校验。优先级如下：

**第一优先级（数据写入核心 API）：**
1. `POST /api/purchase-receipts` — 采购单创建，包含 `items` 数组
2. `PUT /api/purchase-receipts/[id]` — 采购单更新（如已存在）
3. `POST /api/schedules` — 排程创建
4. `PUT /api/schedules/[id]` — 排程修改
5. `POST /api/dishes` — 菜品创建
6. `PUT /api/dishes/[id]` — 菜品更新
7. `POST /api/dishes/[id]/bom` — BOM 批量替换
8. `POST /api/dishes/[id]/processes` — 工艺批量替换
9. `POST /api/ingredients` — 原料创建
10. `PUT /api/ingredients/[id]` — 原料更新
11. `POST /api/net-ingredients` — 净料创建
12. `PUT /api/net-ingredients/[id]` — 净料更新
13. `POST /api/sauce-ingredients` — 酱料创建
14. `PUT /api/sauce-ingredients/[id]` — 酱料更新
15. `POST /api/purchase-reimbursements` — 报销创建
16. `POST /api/users` — 用户创建
17. `PUT /api/users/[id]` — 用户更新
18. `PUT /api/users/profile` — 个人资料更新

**第二优先级（数据写入字典 API）：**
19. `POST /api/dish-categories` + `PUT /api/dish-categories/[id]`
20. `POST /api/ingredient-categories` + `PUT /api/ingredient-categories/[id]`
21. `POST /api/suppliers` + `PUT /api/suppliers/[id]`
22. `POST /api/units` + `PUT /api/units/[id]`

**校验规范：**
- 在 `lib/schemas/` 目录下创建对应的 Zod schema 文件（如 `lib/schemas/purchase-receipt.ts`、`lib/schemas/schedule.ts`）
- 复用现有 `lib/validate.ts` 的 `validateBody` 和 `validateQuery` 函数
- POST 请求校验 body，GET 请求校验 query 参数（如分页参数、筛选参数）
- 校验失败时返回 `400 Bad Request` + 具体错误信息（如 `lib/validate.ts` 的现有格式）
- 校验规则应与数据库字段约束对齐（字符串长度、数值范围、必填/可选）

#### 涉及范围
- 新建/修改 `lib/schemas/*.ts` 文件
- 修改 `app/api/*/route.ts` 文件
- 注意：已存在的 `lib/schemas/ingredient.ts` 和 `lib/schemas/auth.ts` 可作为参考模板

#### 注意事项
- 不要修改现有数据库字段约束，只在前端 API 层做校验
- 保持与现有 `validateBody` 返回格式一致（`{ success: true, data }` 或 `{ success: false, response }`）
- 对于复杂嵌套结构（如采购单的 `items` 数组），需定义嵌套 Zod schema
- 不要引入新的校验库，继续使用 `zod`

---

### 需求 P0-4：消除 any 类型与 ESLint 错误

#### 现状问题
- `app/api/dishes/route.ts` 第 6 行：导入 `success` 但未使用，导致 ESLint error：`@typescript-eslint/no-unused-vars`
- `app/components/form-field.tsx` 第 41 行：使用了 `any` 类型
- `app/ingredients/seasoning/page.tsx` 第 122-124、128、163 行：5 处使用了 `any` 类型
- 违反项目 AGENTS.md 红线："禁止新增任何 `any` 类型"

#### 目标业务逻辑
1. **修复 ESLint error**：
   - 移除 `app/api/dishes/route.ts` 中未使用的 `success` 导入，或改为使用 `_success` 前缀（如果保留）
   - 确保 `npm run lint` 不再报错（warning 可接受，但需逐步清理）

2. **消除 any 类型**：
   - `app/components/form-field.tsx` 第 41 行：找到合适的 TypeScript 类型替换 `any`
   - `app/ingredients/seasoning/page.tsx`：5 处 `any` 替换为具体类型（如 `FormData` 或对应接口类型）
   - 如果某处确实无法确定类型（如第三方库返回的未知结构），使用 `unknown` 而非 `any`，并做类型守卫

#### 涉及范围
- `app/api/dishes/route.ts`
- `app/components/form-field.tsx`
- `app/ingredients/seasoning/page.tsx`

#### 注意事项
- 不要引入新的类型定义文件，优先复用现有接口类型（如 `lib/schemas/*.ts` 中的类型、Prisma Client 生成的类型）
- 如果无法确定精确类型，使用 `unknown` + 运行时类型检查，绝不使用 `as any`
- 修复后 `npm run lint` 应无 errors（warnings 可逐步清理）

---

## 三、数据模型变更

本次 P0 修复不涉及数据库 Schema 变更，无需执行 `prisma migrate dev`。

但需注意：API 分页返回的数据结构变更可能影响前端组件。

### 响应格式约定（新增）

**带分页的列表 API 统一响应格式：**

```typescript
interface PaginatedResponse<T> {
  code: 200;
  data: {
    items: T[];
    pagination: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      pageSize: number;
    };
  };
}
```

**现有已分页的 API（`/api/dishes`、`/api/purchase-receipts`）的响应格式需确认是否已符合上述约定。如果不符合，需统一。**

---

## 四、API 接口变更

### 1. GET 列表 API 分页参数

**所有受影响 API 统一新增查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 约束 |
|------|------|------|--------|------|
| page | number | 否 | 1 | ≥ 1 |
| pageSize | number | 否 | 20 | 1 ≤ pageSize ≤ 100 |

**示例：**
```
GET /api/ingredients?page=2&pageSize=20
GET /api/schedules?page=1&pageSize=10&status=active
```

### 2. POST/PUT API 输入校验

**所有受影响 API 的请求体需通过 Zod schema 校验。**

**示例（采购单创建）：**
```typescript
// lib/schemas/purchase-receipt.ts
export const createPurchaseReceiptSchema = z.object({
  receiptDate: z.string().datetime().or(z.string().date()),
  supplierId: z.number().int().optional(),
  summary: z.string().max(200).optional(),
  items: z.array(z.object({
    ingredientId: z.number().int().optional(),
    itemName: z.string().min(1).max(100),
    spec: z.string().max(100).optional(),
    qty: z.number().positive(),
    priceUnit: z.string().max(20),
    unitPrice: z.number().nonnegative(),
    amount: z.number().nonnegative(),
  })).min(1),
});
```

**API 层使用方式：**
```typescript
import { validateBody } from "@/lib/validate";
import { createPurchaseReceiptSchema } from "@/lib/schemas/purchase-receipt";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const validation = validateBody(createPurchaseReceiptSchema, body);
  if (!validation.success) return validation.response;
  const { receiptDate, items, ... } = validation.data;
  // ... 继续业务逻辑
}
```

---

## 五、交互设计与页面规范

### 分页组件规范

- 前端列表页使用统一分页组件（如 `app/components/pagination.tsx` 或 shadcn/ui 的 Pagination）
- 分页条显示：`共 N 条，分 M 页`，与现有菜品列表页保持一致
- 每页条数选择：提供 10 / 20 / 50 / 100 选项（或固定 20）
- 页码输入：支持直接跳转到指定页码
- 排序：保持现有排序逻辑（`createdAt: desc`）

### 空状态规范

- 分页后如果当前页无数据，显示空状态组件（`app/components/empty-state.tsx`）
- 空状态文案统一："暂无数据" + 可选操作按钮

### 加载状态规范

- 分页切换时显示骨架屏（`app/components/skeleton-table.tsx`）
- 不要全局 loading，只局部刷新表格区域

---

## 六、技术约束与红线

以下约束来自项目 `AGENTS.md`，执行时严格遵守：

- ❌ **禁止新增 `any` 类型**：现有代码中的 `any` 需全部消除
- ❌ **禁止新增无分页的列表 API**：本次修复的 12 个 API 必须全部补充分页
- ✅ **输入校验**：所有 POST/PUT API 必须添加 Zod 校验（`lib/validate.ts` + `lib/schemas/*.ts`）
- ✅ **错误处理**：返回 `{ code, data?, message? }` 格式，或复用 `lib/api-response.ts` 的 `success`/`badRequest`/`internalError`
- ✅ **类型安全**：无 `any` 类型
- ✅ **Schema 迁移**：本次无 Schema 变更，无需 `prisma migrate dev`
- ✅ **代码提交前强制检查**：
  ```bash
  npx tsc --noEmit   # 必须通过
  npm run build      # 必须通过
  npm run lint       # 必须无 errors
  ```

---

## 七、验收标准

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 1 | 菜品页面变量修复 | `npx tsc --noEmit` 无 `currentPage` 相关错误 | 编译通过 |
| 2 | 分页 API 覆盖 | 12 个 API 的 GET 方法均支持 `page`/`pageSize` 参数 | 代码审查 + API 测试 |
| 3 | 分页响应格式 | 带分页的 API 返回统一格式：`{code, data: {items, pagination}}` | 代码审查 + API 测试 |
| 4 | 前端分页接入 | 食材列表、排程列表、库存列表等页面正确分页展示 | 浏览器测试 |
| 5 | Zod 校验覆盖 | 第一优先级 18 个 API 全部使用 `validateBody` 校验 | 代码审查 |
| 6 | 校验失败响应 | 传入无效参数时返回 400 + 具体错误信息 | API 测试 |
| 7 | any 类型消除 | `npm run lint` 无 `@typescript-eslint/no-explicit-any` error | ESLint 检查 |
| 8 | 未使用变量消除 | `npm run lint` 无 `@typescript-eslint/no-unused-vars` error | ESLint 检查 |
| 9 | TypeScript 编译 | `npx tsc --noEmit` 完全通过 | 命令执行 |
| 10 | Next.js 构建 | `npm run build` 成功（52+ 个路由） | 命令执行 |
| 11 | 端到端功能 | 菜品列表翻页、食材列表分页、排程列表分页正常 | 浏览器测试 |
| 12 | 库存 API 检查 | `/api/inventory` 请求不再返回 500 或失败 | API 测试 + 浏览器测试 |

---

## 八、相关文件参考

### 现有可复用组件/工具

| 文件路径 | 功能说明 | 复用建议 |
|----------|----------|----------|
| `lib/validate.ts` | Zod 校验工具（`validateBody`、`validateQuery`） | 所有新增校验 API 复用 |
| `lib/schemas/ingredient.ts` | 原料 Zod schema 示例 | 新建 schema 的参考模板 |
| `lib/schemas/auth.ts` | 登录 Zod schema 示例 | 新建 schema 的参考模板 |
| `lib/api-response.ts` | 统一响应格式（`success`、`badRequest` 等） | API 返回复用 |
| `app/lib/use-pagination.ts` | 前端分页 hook（`usePagination`） | 前端页面接入分页 |
| `app/components/data-table.tsx` | 通用表格组件 | 分页表格展示 |
| `app/components/pagination.tsx` | 分页组件 | 前端分页 UI |
| `app/components/skeleton-table.tsx` | 表格骨架屏 | 分页加载状态 |
| `app/components/empty-state.tsx` | 空状态组件 | 分页无数据时展示 |
| `app/dishes/page.tsx` | 已有分页实现的菜品列表 | 分页前端接入的参考 |
| `app/api/dishes/route.ts` | 已有分页的 API 示例 | 后端分页实现的参考 |
| `app/api/purchase-receipts/route.ts` | 已有分页的 API 示例 | 后端分页实现的参考 |

### 需要新建的文件

| 文件路径 | 说明 |
|----------|------|
| `lib/schemas/purchase-receipt.ts` | 采购单 Zod schema |
| `lib/schemas/schedule.ts` | 排程 Zod schema |
| `lib/schemas/dish.ts` | 菜品 Zod schema（检查是否已存在） |
| `lib/schemas/dish-bom.ts` | 菜品 BOM Zod schema |
| `lib/schemas/dish-process.ts` | 菜品工艺 Zod schema |
| `lib/schemas/net-ingredient.ts` | 净料 Zod schema |
| `lib/schemas/sauce-ingredient.ts` | 酱料 Zod schema |
| `lib/schemas/purchase-reimbursement.ts` | 报销 Zod schema |
| `lib/schemas/user.ts` | 用户 Zod schema |
| `lib/schemas/dish-category.ts` | 菜品分类 Zod schema |
| `lib/schemas/ingredient-category.ts` | 食材分类 Zod schema |
| `lib/schemas/supplier.ts` | 供应商 Zod schema |
| `lib/schemas/unit.ts` | 单位 Zod schema |

### 需要修改的文件（核心列表）

| 文件路径 | 修改内容 |
|----------|----------|
| `app/dishes/page.tsx` | 修复 `currentPage` → `page` |
| `app/api/dishes/route.ts` | 移除未使用的 `success` 导入 |
| `app/api/ingredients/route.ts` | 添加分页 + Zod 校验（GET query） |
| `app/api/net-ingredients/route.ts` | 添加分页 + Zod 校验 |
| `app/api/sauce-ingredients/route.ts` | 添加分页 + Zod 校验 |
| `app/api/schedules/route.ts` | 添加分页 + Zod 校验 |
| `app/api/inventory/route.ts` | 添加分页 + try-catch 错误处理 |
| `app/api/inventory/ledger/route.ts` | 添加分页 + Zod 校验 |
| `app/api/purchase-reimbursements/route.ts` | 添加分页 + Zod 校验 |
| `app/api/purchase-receipts/route.ts` | 添加 Zod 校验（POST/PUT） |
| `app/api/dish-categories/route.ts` | 添加分页 + Zod 校验 |
| `app/api/ingredient-categories/route.ts` | 添加分页 + Zod 校验 |
| `app/api/suppliers/route.ts` | 添加分页 + Zod 校验 |
| `app/api/units/route.ts` | 添加分页 + Zod 校验 |
| `app/api/users/route.ts` | 添加分页 + Zod 校验 |
| `app/api/dishes/[id]/route.ts` | 添加 Zod 校验（PUT） |
| `app/api/dishes/[id]/bom/route.ts` | 添加 Zod 校验（POST） |
| `app/api/dishes/[id]/processes/route.ts` | 添加 Zod 校验（POST） |
| `app/api/ingredients/[id]/route.ts` | 添加 Zod 校验（PUT） |
| `app/api/net-ingredients/[id]/route.ts` | 添加 Zod 校验（PUT） |
| `app/api/sauce-ingredients/[id]/route.ts` | 添加 Zod 校验（PUT） |
| `app/api/users/[id]/route.ts` | 添加 Zod 校验（PUT） |
| `app/api/users/profile/route.ts` | 添加 Zod 校验（PUT） |
| `app/components/form-field.tsx` | 消除 `any` 类型 |
| `app/ingredients/seasoning/page.tsx` | 消除 5 处 `any` 类型 |
| 前端列表页面（ingredients/*、schedules、inventory、inventory/ledger 等） | 接入分页参数和分页组件 |

---

## 九、边界（不涉及的范围）

以下问题明确排除在本次 P0 修复范围之外，防止 scope creep：

- ❌ 不修改数据库 Schema（无需 `prisma migrate dev`）
- ❌ 不新增页面或功能（如采购计划执行页、采购单编辑页）
- ❌ 不修改 UI/UX 视觉设计（如颜色、布局、字体）
- ❌ 不修改 Google 字体加载方案（P1 问题，不在 P0 修复范围）
- ❌ 不修改 Cloudinary 环境变量（P1 问题，不在 P0 修复范围）
- ❌ 不修改 React 19 useEffect 级联渲染警告（P1 问题，可逐步清理）
- ❌ 不修改 Middleware deprecated 警告（P1 问题，未来升级时处理）
- ❌ 不修改采购管理模块的未完成闭环（P2 问题，v1.1 迭代）

---

*文档版本：v1.0 | 2026-06-27 | 可直接作为 Claude Code 执行输入*
