# 精益厨房 V3 发布前审查报告

> 审查日期：2026-06-27
> 审查范围：采购、菜品、食材、设置、基本功能
> 审查方法：代码静态扫描 + TypeScript编译检查 + ESLint + 浏览器端功能测试（WebBridge）
> 审查结论：**不建议在当前代码状态下直接发布**。存在 P0 级致命缺陷和 P1 级功能不稳定问题，需修复后方可发布第一个版本。

---

## 一、审查总览

| 维度 | 结果 | 说明 |
|------|------|------|
| TypeScript 编译 | ❌ 不通过 | 1 个类型错误阻断编译 |
| Next.js 构建 | ❌ 失败 | 离线环境下 Google 字体下载失败（环境依赖问题） |
| ESLint | ⚠️ 47 个问题 | 1 error + 46 warnings |
| Prisma Schema | ✅ 有效 | `prisma validate` 通过 |
| 浏览器功能测试 | ⚠️ 部分异常 | 库存页面获取数据失败 |

---

## 二、P0 致命问题（发布前必须修复）

### P0-1：菜品页面存在未定义变量，导致运行时崩溃

- **位置**：`app/dishes/page.tsx` 第 319 行、第 418 行
- **问题**：代码中引用了 `currentPage` 和 `setCurrentPage`，但状态变量实际名为 `page`（第 91 行定义）
- **表现**：在 JavaScript 运行时，访问未声明的 `currentPage` 会抛出 `ReferenceError`，导致页面白屏或崩溃
- **修复**：将 `currentPage` 统一改为 `page`
- **当前截图显示正常的原因**：Turbopack dev server 可能缓存了旧版本编译结果，或数据量小未触发该渲染路径

### P0-2：TypeScript 编译不通过，阻断构建

- **位置**：`app/dishes/page.tsx`
- **问题**：`error TS2304: Cannot find name 'currentPage'`
- **影响**：`npx tsc --noEmit` 失败，无法通过代码提交前强制检查
- **关联**：项目 AGENTS.md 要求"以上任一步骤失败，不得提交代码"

### P0-3：大量列表 API 无分页，数据量增长后性能崩溃

- **位置**：多个 API 路由
- **违反**：项目 AGENTS.md 红线 — "禁止新增无分页的列表 API"
- **受影响 API**：

| API 路由 | 是否有分页 | 风险等级 |
|----------|-----------|----------|
| `/api/ingredients` (GET) | ❌ 无 | **高** — 食材数据量大 |
| `/api/net-ingredients` (GET) | ❌ 无 | **中** |
| `/api/sauce-ingredients` (GET) | ❌ 无 | **低** |
| `/api/schedules` (GET) | ❌ 无 | **高** — 排程随时间积累 |
| `/api/inventory` (GET) | ❌ 无 | **中** |
| `/api/inventory/ledger` (GET) | ❌ 无 | **高** — 台账流水量极大 |
| `/api/purchase-reimbursements` (GET) | ❌ 无 | **中** |
| `/api/dish-categories` (GET) | ❌ 无 | 数据量小，可接受 |
| `/api/ingredient-categories` (GET) | ❌ 无 | 数据量小，可接受 |
| `/api/suppliers` (GET) | ❌ 无 | 数据量小，可接受 |
| `/api/units` (GET) | ❌ 无 | 数据量小，可接受 |
| `/api/users` (GET) | ❌ 无 | 数据量小，可接受 |
| `/api/dishes` (GET) | ✅ 有 | — |
| `/api/purchase-receipts` (GET) | ✅ 有 | — |

### P0-4：绝大部分 API 无输入校验（Zod 或手动），存在安全与数据完整性风险

- **统计**：40 个 API 路由中，仅 `auth/login` 和 `ingredients` (GET) 使用了 Zod 校验
- **位置**：`app/api/*/route.ts` 中大量使用 `const body = await req.json()` 直接解析，无校验
- **影响**：
  - 恶意请求可导致 Prisma 查询异常或注入风险
  - 数据类型不匹配可导致运行时错误
  - 缺少字段校验可导致数据库写入失败
- **典型案例**：
  - `POST /api/purchase-receipts` 直接解析 JSON，未校验 `items` 数组结构
  - `POST /api/schedules` 未校验日期格式和菜品数量
  - 所有字典 CRUD API 未校验必填字段

---

## 三、P1 严重问题（影响功能稳定性）

### P1-1：库存页面显示"获取库存数据失败"

- **位置**：`app/inventory/page.tsx`
- **表现**：浏览器端弹出 toast "获取库存数据失败"，但页面同时显示空状态（见截图证据）
- **根因分析**：页面使用 `Promise.all` 同时请求 3 个 API（`/api/inventory` + `/api/ingredients` + `/api/ingredient-categories?type=l1`），**任何一个失败即全部失败**。同时 `/api/inventory` 无 try-catch 包裹，Prisma 异常会直接抛出 500
- **建议**：
  1. 给 `/api/inventory` 加 try-catch 错误处理
  2. 前端改为独立请求 + 部分降级，避免一个 API 失败导致整个页面不可用

### P1-2：React 19 严格模式下多处 useEffect 警告

- **统计**：ESLint 检出 46 个 warnings，其中 10+ 个是 React 19 严格模式相关
- **问题类型**：
  - `react-hooks/set-state-in-effect`：在 effect 中同步调用 `setState`，React 19 下可能导致级联渲染或无限循环
  - `react-hooks/exhaustive-deps`：useEffect 依赖数组缺失
- **受影响文件**：
  - `app/components/ingredient-selector-dialog.tsx` (第 67 行)
  - `app/components/supplier-select.tsx` (第 31 行)
  - `app/ingredients/net/page.tsx` (第 132 行)
  - `app/page.tsx` (第 40 行：变量声明前访问)
  - `app/schedules/page.tsx` (第 67 行 + 缺少依赖)
  - `app/settings/*/page.tsx` (多个字典页面)

### P1-3：构建在离线/受限网络环境下失败

- **位置**：`app/layout.tsx` 第 2-13 行
- **问题**：使用 `next/font/google` 加载 `Geist_Mono` 和 `DM_Sans`，构建时尝试从 `fonts.gstatic.com` 下载
- **表现**：在无法访问 Google Fonts 的网络环境下，`npm run build` 失败，2 个 Module not found 错误
- **影响**：部署到国内服务器或 CI 环境可能构建失败
- **建议**：
  - 方案 A：使用 `next/font/local` 加载本地字体文件
  - 方案 B：使用 `@fontsource` 包管理字体，或配置字体加载 fallback
  - 方案 C：构建环境确保网络可达 Google Fonts

### P1-4：环境变量中 Cloudinary 配置为占位值

- **位置**：`.env` 第 13-14 行
- **问题**：`CLOUDINARY_CLOUD_NAME="test"`、`CLOUDINARY_UPLOAD_PRESET="test"`
- **影响**：采购单拍照上传功能无法正常工作，图片上传会失败
- **建议**：生产环境必须配置真实的 Cloudinary 账户信息

### P1-5：未使用的变量与 `any` 类型使用（违反项目红线）

- **ESLint error**：`app/api/dishes/route.ts` 第 6 行 — `success` 导入但未使用
- **ESLint warnings**：
  - `app/components/form-field.tsx` 第 41 行：`any` 类型
  - `app/ingredients/seasoning/page.tsx` 第 122-124、128、163 行：5 处 `any` 类型
- **违反**：项目 AGENTS.md 红线 — "禁止新增任何 `any` 类型"

### P1-6：Middleware 已废弃警告

- **位置**：`middleware.ts` 根目录
- **问题**：Next.js 16.2.7 提示 `"middleware" file convention is deprecated. Please use "proxy" instead`
- **影响**：未来 Next.js 版本升级时 middleware 可能不再支持
- **建议**：评估迁移到 `proxy` 方案，或在当前版本保持并关注升级路径

---

## 四、P2 中等问题（建议修复）

### P2-1：功能缺失（已知 TODO，不影响发布但影响闭环）

- `/schedules/[id]/purchase` 页面未创建 — 采购计划执行入口缺失
- `/purchases/[id]/edit` 页面未创建 — 采购单无法编辑
- `POST /api/schedules/[id]/execute-purchase` 未创建 — 无法将采购计划转为采购单

### P2-2：API 响应格式不统一

- 部分 API 返回 `{ code, data, message }` 格式（如 `lib/api-response.ts` 的 `success()`）
- 部分 API 直接返回原始数组（如 `/api/inventory` 返回 `NextResponse.json(result)`）
- 建议统一为 `{ code, data?, message? }` 格式

### P2-3：Git 工作区不干净

- 当前工作区有 **21 个未提交文件**（18 个修改 + 3 个新增未跟踪）
- 大量文件属于菜品档案重构中的半成品状态
- 建议：提交或回滚，确保发布版本基于干净的 commit

---

## 五、功能测试截图证据

### 5.1 工作台页面 — ✅ 正常

- 侧边栏导航完整：工作台、排程、采购、库存、菜品、食材、设置
- 用户区显示正常："张浩" / "系统管理员"
- 今日排程区域显示"暂无进行中的排程"（空状态正常）

### 5.2 菜品库页面 — ⚠️ 有隐患

- 页面可正常加载，显示 2 条菜品记录
- 筛选、搜索、分页组件正常渲染
- ⚠️ **隐患**：`currentPage` 未定义，在特定场景（翻页后渲染序号列）可能触发 `ReferenceError`

### 5.3 采购管理页面 — ✅ 正常

- 采购单列表正常加载，显示多条记录
- 状态筛选（待结算/已结算/已作废/全部）正常
- 搜索、日期筛选、分页正常
- 供应商名称、操作人姓名正确展示

### 5.4 库存管理页面 — ❌ 异常

- 页面显示"暂无库存数据"空状态
- **右下角弹出 toast："获取库存数据失败"**
- 理论上存在采购单数据，库存不应为空
- 需要排查 `/api/inventory` 或 `/api/ingredients` 的实际错误原因

### 5.5 排程管理页面 — ✅ 正常

- 状态 Tab 筛选正常（全部/待生效/进行中/已完成）
- 搜索、日期筛选正常
- 空状态"暂无排程"正常显示

### 5.6 设置页面 — ✅ 正常

- 5 个入口卡片正常：菜品类别、食材分类、单位、供应商、用户管理
- 布局、图标、文字正常

---

## 六、修复建议与优先级

### 发布前必须完成（P0）

| # | 任务 | 文件 | 预估工时 |
|---|------|------|----------|
| 1 | 修复 `currentPage` → `page` 变量名错误 | `app/dishes/page.tsx` | 5 分钟 |
| 2 | 为无分页列表 API 补充分页 | 12 个 API 文件 | 2-3 小时 |
| 3 | 为核心 API 补充 Zod 输入校验 | `POST` / `PUT` API | 3-4 小时 |
| 4 | 修复 `any` 类型和未使用变量 | 3 个文件 | 15 分钟 |
| 5 | 修复 `app/page.tsx` 变量声明前访问 | `app/page.tsx` | 10 分钟 |
| 6 | 修复 React 19 useEffect 级联渲染警告 | 7 个文件 | 1 小时 |

### 发布前强烈建议完成（P1）

| # | 任务 | 文件 | 预估工时 |
|---|------|------|----------|
| 7 | 排查库存页面"获取失败"根因 | `app/inventory/page.tsx` + API | 1-2 小时 |
| 8 | 为 `/api/inventory` 添加 try-catch | `app/api/inventory/route.ts` | 10 分钟 |
| 9 | 修复 Google 字体构建失败 | `app/layout.tsx` + 字体配置 | 1 小时 |
| 10 | 配置真实 Cloudinary 环境变量 | `.env` / 部署平台 | 30 分钟 |
| 11 | 清理 Git 工作区（提交或回滚）| 全部 | 30 分钟 |

### 发布后迭代（P2）

| # | 任务 | 说明 |
|---|------|------|
| 12 | 创建采购计划执行页面 | `/schedules/[id]/purchase` |
| 13 | 创建采购单编辑页面 | `/purchases/[id]/edit` |
| 14 | 统一 API 响应格式 | 全部返回 `{code, data, message}` |
| 15 | Middleware 迁移到 proxy | Next.js 16 升级适配 |

---

## 七、强制检查清单（发布前）

根据项目 `AGENTS.md` 要求，发布前必须依次执行：

```bash
# 1. TypeScript 编译检查
npx tsc --noEmit
# 当前状态：❌ 失败（currentPage 未定义）

# 2. 构建检查
npm run build
# 当前状态：❌ 失败（Google 字体下载失败）

# 3. ESLint 检查
npm run lint
# 当前状态：⚠️ 有 error（未使用变量）和 46 个 warnings
```

**结论：当前三项检查均不通过，不满足发布条件。**

---

## 八、风险评估

| 风险 | 概率 | 影响 | 说明 |
|------|------|------|------|
| 菜品页面运行时崩溃 | 高 | 高 | `currentPage` 未定义，在翻页场景必现 |
| 库存功能不可用 | 高 | 高 | 页面持续报错，无法查看库存 |
| 构建/部署失败 | 中 | 高 | 国内环境 Google 字体下载失败 |
| 数据量增长后性能崩溃 | 中 | 高 | 12 个 API 无分页 |
| 图片上传功能不可用 | 高 | 中 | Cloudinary 配置为占位值 |
| 安全/数据注入风险 | 中 | 中 | 大量 API 无输入校验 |
| React 19 严格模式异常 | 中 | 中 | useEffect 级联渲染可能导致性能问题或循环 |

---

> **最终建议**：
> 1. **今日优先修复 P0-1 到 P0-4**（预计 1 天工作量），完成后重新执行 `tsc → build → lint` 三件套。
> 2. **P1 问题在修复 P0 后同步处理**，特别是库存 API 错误和 Cloudinary 配置。
> 3. **功能缺失（P2-1）可放入 v1.1 迭代**，不影响第一个版本的发布。
> 4. 所有代码修改后必须按 AGENTS.md 顺序执行强制检查，全部通过后方可提交和部署。
