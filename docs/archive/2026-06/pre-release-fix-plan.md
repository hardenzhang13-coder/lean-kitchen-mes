# 精益厨房 V3 发布前整改方案

> 审查日期：2026-06-27
> 审查范围：采购、菜品、食材、设置、库存、排程模块功能稳定性
> 审查结论：**存在 P0 级回归缺陷，今日上线前必须修复**

---

## 一、审查总览

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `npx tsc --noEmit` | ✅ 通过 | P0 基础修复已完成 |
| `npm run build` | ✅ 通过 | 52+ 路由构建成功 |
| `npm run lint` | ⚠️ 43 warnings | 0 errors，但 React 19 严格模式警告需关注 |
| Prisma Schema | ✅ 有效 | 数据库模型正常 |
| 浏览器功能测试 | ❌ 发现问题 | 新建采购单页面白屏、下架功能失败 |

---

## 二、P0 致命问题（今日上线前必须修复）

### P0-1：新建采购单页面白屏 — `units.map is not a function`

- **测试证据**：截图显示 `Runtime TypeError: units.map is not a function`，发生在 `app/purchases/new/page.tsx:221`
- **根因**：P0 修复统一了 API 响应格式为 `{success, data, pagination}`，但前端 4 个文件仍按旧格式直接设置数据
- **受影响文件**：

| 文件 | 问题代码 | 修复方式 |
|------|----------|----------|
| `app/purchases/new/page.tsx:282` | `.then((data) => setCategories(data))` | `.then((res) => setCategories(res.data?.items \|\| res.data \|\| []))` |
| `app/purchases/new/page.tsx:286` | `.then((data) => setUnits(data))` | `.then((res) => setUnits(res.data?.items \|\| res.data \|\| []))` |
| `app/components/unit-select.tsx:38` | `.then((data: Unit[]) => { setUnits(data \|\| []) })` | `.then((res) => { setUnits(res.data?.items \|\| res.data \|\| []) })` |
| `app/purchases/reimbursements/page.tsx:36` | `setRows(data)` | `setRows(data.data?.items \|\| data.data \|\| [])` |
| `app/settings/classes/page.tsx:65` | `setData(json)` | `setData(json.data?.items \|\| json.data \|\| [])` |

**修复优先级**：最高。新建采购单是核心业务流程，当前完全无法使用。

### P0-2：已发布菜品无法下架

- **测试证据**：已发布菜品点击"下架"→确认对话框→"确认下架"→toast 提示"已发布菜品不可修改，请先下架"→状态未变
- **根因**：`lib/schemas/dish.ts:19` 的 `updateDishSchema = createDishSchema.partial()` 保留了 `.default()`
- 当 `body = {status: "draft"}` 时，Zod 解析后 `portion = "正餐份量"`、`season = "四季"` 被填充为默认值
- API 下架校验：`const hasOtherChanges = Object.values(rest).some((v) => v !== undefined)` → 因为默认值存在，`hasOtherChanges = true` → 拒绝下架

**修复方案**：
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

### P0-3：工作台页面排程数据可能异常

- **代码位置**：`app/page.tsx:47`
- **问题**：`setActiveSchedules(data)` 和 `data.length > 0`
- **分析**：`/api/schedules/active` 直接返回数组（非统一格式），所以 `data` 是数组 → 当前没问题
- **但**：如果该 API 未来被统一格式，会出问题。建议也统一处理

---

## 三、P1 严重问题（强烈建议修复）

### P1-1：新建/编辑菜品页面加载缓慢（3-5秒）

- **根因**：页面加载时同时发起 6-7 个请求，其中 `/api/ingredients` 返回全部 259 条数据
- **影响**：用户打开新建菜品页需等待 3-5 秒，BOM 编辑器预加载全量食材导致内存压力
- **方案**：详见 `docs/dish-module-loading-optimization-spec.md`
- **建议**：如今日必须上线，可先只做 API 分页（P0-2 已覆盖），前端按需加载优化放入 v1.1

### P1-2：React 19 严格模式 43 个 warnings

- **统计**：ESLint 检出 43 个 warnings，其中 10+ 个是 `react-hooks/set-state-in-effect`
- **影响**：在 React 19 严格模式下，同步 `setState` 可能导致级联渲染、性能下降，极端情况下可能触发无限循环
- **受影响文件**：
  - `app/purchases/page.tsx` (第 76、82 行)
  - `app/settings/categories/page.tsx` (第 61 行)
  - `app/settings/classes/page.tsx` (第 74 行)
  - `app/settings/suppliers/page.tsx` (第 62 行)
  - `app/settings/units/page.tsx` (第 73 行)
  - `app/ingredients/net/page.tsx` (第 132 行)
  - `app/ingredients/seasoning/page.tsx` (第 122 行)
  - `app/components/ingredient-selector-dialog.tsx` (第 67 行)
  - `app/components/supplier-select.tsx` (第 31 行)

### P1-3：Google 字体构建失败

- **位置**：`app/layout.tsx` 使用 `next/font/google` 加载 `Geist_Mono` 和 `DM_Sans`
- **影响**：离线环境或国内服务器无法构建
- **建议**：改为 `next/font/local` 或本地字体文件

### P1-4：Cloudinary 配置为占位值

- **位置**：`.env` 中 `CLOUDINARY_CLOUD_NAME="test"`、`CLOUDINARY_UPLOAD_PRESET="test"`
- **影响**：采购单拍照上传功能无法使用

### P1-5：库存页面历史问题已修复

- **状态**：之前测试时显示"获取库存数据失败"，现在已正常加载（见截图）
- **说明**：P0 修复已解决该问题

---

## 四、功能模块健康度评估

### 4.1 采购模块

| 功能 | 状态 | 说明 |
|------|------|------|
| 采购单列表 | ✅ 正常 | 列表、筛选、分页、搜索正常 |
| 新建采购单 | ❌ **P0 白屏** | `units.map is not a function` |
| 采购单编辑 | ⚠️ 待验证 | 依赖新建页修复 |
| 采购单作废 | ✅ 正常 | 事务中处理库存回滚 |
| 报销列表 | ⚠️ **可能异常** | `setRows(data)` 未提取 `.data` |
| 报销详情 | ✅ 正常 | API 直接返回对象，前端正确处理 |
| 报销新建 | ✅ 正常 | 依赖采购单数据，API 已分页 |
| AI 识别 | ⚠️ 待验证 | 依赖 Cloudinary，配置为占位值 |

### 4.2 菜品模块

| 功能 | 状态 | 说明 |
|------|------|------|
| 菜品列表 | ✅ 正常 | 筛选、搜索、分页正常 |
| 菜品新建 | ⚠️ 加载慢 | 6-7 个请求，3-5 秒加载 |
| 菜品编辑 | ⚠️ 加载慢 | 同新建页 |
| 菜品发布 | ✅ 正常 | 确认对话框→状态变更→toast 成功 |
| 菜品下架 | ❌ **P0 失败** | 状态不变，toast 错误提示 |
| 菜品删除 | ✅ 正常 | 草稿可删除，已发布不可删除 |
| BOM 编辑器 | ✅ 功能正常 | 分类选择、搜索、添加、删除、用量编辑正常 |
| 工艺编辑器 | ✅ 正常 | 增删改、排序正常 |
| 详情 Sheet | ✅ 正常 | 基础信息、用料、工艺展示正常 |

### 4.3 食材模块

| 功能 | 状态 | 说明 |
|------|------|------|
| 原料列表 | ✅ 正常 | 分页正常（P0 修复） |
| 原料新建/编辑 | ✅ 正常 | 表单提交正常 |
| 原料删除 | ✅ 正常 | 软删除 |
| 净料列表 | ✅ 正常 | 分页正常 |
| 净料新建/编辑 | ✅ 正常 | 关联原料选择正常 |
| 小料列表 | ✅ 正常 | 分页正常 |
| 调料列表 | ✅ 正常 | 分页正常 |
| 酱料列表 | ✅ 正常 | 分页正常 |
| 食材分类设置 | ⚠️ **可能异常** | `setData(json)` 未提取 `.data` |

### 4.4 设置模块

| 功能 | 状态 | 说明 |
|------|------|
| 菜品类别 | ✅ 正常 | 增删改正常 |
| 食材分类 | ⚠️ **可能异常** | 代码中 `setData(json)` 未提取 `.data` |
| 单位管理 | ⚠️ **可能异常** | 组件 `unit-select.tsx` 中 `setUnits(data)` 未提取 `.data` |
| 供应商管理 | ✅ 正常 | 增删改正常 |
| 用户管理 | ✅ 正常 | 增删改正常 |
| 个人资料 | ✅ 正常 | 修改正常 |

### 4.5 库存模块

| 功能 | 状态 | 说明 |
|------|------|------|
| 库存列表 | ✅ 正常 | 已修复，数据正常展示 |
| 库存台账 | ✅ 正常 | 分页正常 |
| 库存明细 | ✅ 正常 | 按食材展示入库记录 |

### 4.6 排程模块

| 功能 | 状态 | 说明 |
|------|------|------|
| 排程列表 | ✅ 正常 | 筛选、分页正常 |
| 排程新建 | ✅ 正常 | 表单提交正常 |
| 排程编辑 | ✅ 正常 | 修改正常 |
| 排程详情 | ✅ 正常 | 展示正常 |
| 采购计划执行 | ❌ 未实现 | `/schedules/[id]/purchase` 页面不存在 |

---

## 五、整改任务清单（按优先级排序）

### 阶段 1：P0 修复（必须今日完成，预估 1-2 小时）

| # | 任务 | 文件 | 修复内容 | 预估时间 |
|---|------|------|----------|----------|
| 1.1 | 修复新建采购单页面白屏 | `app/purchases/new/page.tsx` | `setCategories(data)` → `setCategories(res.data?.items \|\| res.data \|\| [])` | 10 分钟 |
| 1.2 | 修复单位选择器 | `app/components/unit-select.tsx` | `setUnits(data \|\| [])` → `setUnits(res.data?.items \|\| res.data \|\| [])` | 10 分钟 |
| 1.3 | 修复报销列表 | `app/purchases/reimbursements/page.tsx` | `setRows(data)` → `setRows(data.data?.items \|\| data.data \|\| [])` | 10 分钟 |
| 1.4 | 修复食材分类设置 | `app/settings/classes/page.tsx` | `setData(json)` → `setData(json.data?.items \|\| json.data \|\| [])` | 10 分钟 |
| 1.5 | 修复菜品下架 | `lib/schemas/dish.ts` | `updateDishSchema` 去掉 `.default()`，改为纯 `.optional()` | 10 分钟 |
| 1.6 | 浏览器验证 | — | 验证：新建采购单、单位选择、报销列表、分类设置、菜品下架 | 30 分钟 |
| 1.7 | 强制检查 | — | `tsc --noEmit` → `build` → `lint` | 20 分钟 |

### 阶段 2：P1 修复（强烈建议今日完成，预估 2-3 小时）

| # | 任务 | 文件 | 修复内容 | 预估时间 |
|---|------|------|----------|----------|
| 2.1 | 修复 React 19 setState in effect | `app/purchases/page.tsx` 等 8 个文件 | 将 `useEffect(() => { fetchData() }, [])` 改为 `useEffect(() => { fetchData() }, [])` 但不直接 setState，或使用 `useActionState` | 1-2 小时 |
| 2.2 | 修复 Google 字体构建 | `app/layout.tsx` | 改为 `next/font/local` 或本地字体 | 30 分钟 |
| 2.3 | 配置 Cloudinary | `.env` | 配置真实 Cloudinary 账户 | 30 分钟 |

### 阶段 3：加载优化（可放入 v1.1，预估 4-6 小时）

| # | 任务 | 说明 | 预估时间 |
|---|------|------|----------|
| 3.1 | BOM 选择器按需加载 | 弹窗打开时才加载食材，按分类懒加载 | 3-4 小时 |
| 3.2 | 新建/编辑页减少预加载请求 | 从 6-7 个减少到 2 个 | 1-2 小时 |

---

## 六、验收标准

### 阶段 1 验收（必须全部通过）

| # | 验收项 | 验证方式 |
|---|--------|----------|
| 1 | 打开 `/purchases/new` 不报错 | 浏览器截图 |
| 2 | 新建采购单页面单位下拉有数据 | 浏览器交互 |
| 3 | 报销列表页面有数据 | 浏览器截图 |
| 4 | 食材分类设置页面有数据 | 浏览器截图 |
| 5 | 已发布菜品可正常下架 | 浏览器交互：发布→下架→确认→状态变草稿 |
| 6 | `tsc --noEmit` 通过 | 命令执行 |
| 7 | `npm run build` 成功 | 命令执行 |
| 8 | `npm run lint` 无 errors | 命令执行 |

---

## 七、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 新建采购单无法使用 | 已发生 | **高** | 阶段 1.1 修复 |
| 已发布菜品无法下架 | 已发生 | **高** | 阶段 1.5 修复 |
| 报销列表无法加载 | 高 | 中 | 阶段 1.3 修复 |
| 食材分类设置无法加载 | 高 | 中 | 阶段 1.4 修复 |
| 单位选择器不可用 | 高 | 中 | 阶段 1.2 修复 |
| 其他回归问题未被发现 | 中 | 高 | 全面测试验证 |
| React 19 级联渲染 | 中 | 中 | 阶段 2.1 修复 |
| 图片上传不可用 | 高 | 中 | 阶段 2.3 配置 Cloudinary |

---

## 八、直接交付给 CC 的修复指令

```
请修复以下 P0 级回归问题（API 响应格式统一后前端未同步更新）：

1. app/purchases/new/page.tsx:282
   .then((data) => setCategories(data))
   → .then((res) => setCategories(res.data?.items || res.data || []))

2. app/purchases/new/page.tsx:286
   .then((data) => setUnits(data))
   → .then((res) => setUnits(res.data?.items || res.data || []))

3. app/components/unit-select.tsx:38
   .then((data: Unit[]) => { setUnits(data || []) })
   → .then((res) => { setUnits(res.data?.items || res.data || []) })

4. app/purchases/reimbursements/page.tsx:36
   setRows(data)
   → setRows(data.data?.items || data.data || [])

5. app/settings/classes/page.tsx:65
   setData(json)
   → setData(json.data?.items || json.data || [])

6. lib/schemas/dish.ts:19
   重写 updateDishSchema，去掉 createDishSchema.partial() 中的 .default()

修复后执行：
  npx tsc --noEmit
  npm run build
  npm run lint

然后浏览器验证：
  1. /purchases/new 能正常打开
  2. 新建采购单页面单位下拉有数据
  3. 已发布菜品可以下架（发布→下架→状态变草稿）
```

---

*文档版本：v1.0 | 2026-06-27 | 基于代码扫描 + 浏览器端测试*
