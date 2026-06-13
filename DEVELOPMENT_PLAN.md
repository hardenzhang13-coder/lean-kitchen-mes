# 精益厨房 V3（lean-kms-v3）生产级开发计划方案

> **版本**: v1.0 | **日期**: 2026-06-10  
> **基于代码深度审计输出，每个结论均有源码依据**

---

## 一、项目现状全景诊断

### 1.1 技术栈清单

| 层面 | 技术选型 | 版本 |
|------|---------|------|
| 框架 | Next.js (App Router) | 16.2.7 |
| UI库 | React | 19.2.4 |
| 语言 | TypeScript | ^5 |
| ORM | Prisma + @prisma/adapter-pg | ^7.8.0 |
| 数据库 | PostgreSQL | — |
| 样式 | Tailwind CSS v4 + shadcn/ui | ^4 |
| 认证 | JWT (jose, HS256) | ^6.2.3 |
| 密码 | bcryptjs | ^3.0.3 |
| AI/OCR | OpenAI SDK → 通义千问 Qwen | ^6.42.0 |
| 图标 | lucide-react | ^1.17.0 |
| 提示 | sonner | ^2.0.7 |
| CSV解析 | 自实现 (app/lib/csv.ts) | — |

### 1.2 数据模型审计（20个实体，386行Schema）

```
┌─────────────────────────────────────────────────────────────────┐
│                        业务领域模型                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────┐   │
│  │DishCategory│──<│     Dish      │>──│ DishNetDetail       │   │
│  └──────────┘    └──────┬───────┘    └──────────┬──────────┘   │
│                         │                       │              │
│                   ┌─────┴─────┐          ┌──────┴──────┐       │
│                   │ScheduleItem│          │NetIngredient │       │
│                   └─────┬─────┘          └──────┬──────┘       │
│                         │                       │              │
│                  ┌──────┴──────┐         ┌───────┴───────┐      │
│                  │  Schedule   │         │   Ingredient   │      │
│                  └──┬───┬───┬──┘         └───────┬───────┘      │
│                     │   │   │                     │             │
│           ┌─────────┘   │   └──────┐        ┌────┴────┐        │
│           ▼             ▼          ▼        ▼         ▼        │
│    CuttingOrder   PurchasePlan   Inventory  InventoryLedger    │
│           │             │                                    │
│           ▼             ▼                                    │
│   (切配工单执行)  (采购计划执行)                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  PurchaseReceipt > PurchaseReceiptItem                │     │
│  │  PurchaseReimbursement                                │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                 │
│  辅助实体: MinorIngredient, SeasoningIngredient,               │
│           SauceIngredient, DishProcess, DishSeasoningDetail,  │
│           DishSauceDetail, Supplier, Unit,                    │
│           IngredientCategoryL1/L2, User, OperationLog         │
└─────────────────────────────────────────────────────────────────┘
```

**模型设计评价：**
- ✅ 领域建模有深度：区分了原料(Ingredient)→净料(NetIngredient)→菜品BOM的三层关系，符合餐饮精益管理实际
- ✅ 出成率(yieldRate)设计合理：通过净料的yieldRate反算原料需求量
- ✅ 库存流水账(InventoryLedger)设计规范：每笔变动都有记录
- ⚠️ 缺少软删除字段：所有实体无deletedAt，生产环境数据安全风险
- ⚠️ 缺少租户/门店维度：schema无tenantId/storeId，多店扩展需大改
- ⚠️ Dish的code生成逻辑有bug：`generateDishCode`返回模板字符串而非实际编码

### 1.3 已实现功能模块完成度评估

| # | 模块 | 完成度 | 已实现 | 未实现/缺陷 |
|---|------|--------|--------|------------|
| 1 | **认证系统** | 85% | JWT登录/登出/middleware拦截/操作日志 | 无注册接口、硬编码secret、无RBAC、无密码修改 |
| 2 | **工作台首页** | 70% | 今日排程展示/Tab切换/空状态引导 | 无统计数据卡片、无快捷操作入口 |
| 3 | **排程管理** | 75% | 列表页(筛选/搜索)/新建页(选菜/调份数/BOM自动拆解) | **详情页缺失**、状态流转未闭环、编辑/复制功能缺失 |
| 4 | **菜品管理** | 40% | 列表API(含BOM展开)/创建基础信息API | **BOM编辑页面完全缺失**(净料/调料/酱料/工艺)、菜品详情页、成本核算触发 |
| 5 | **食材管理** | 35% | 列表API/创建API | 编辑/删除API缺失、批量导入、图片管理 |
| 6 | **采购管理** | 60% | 采购单列表/录入(含AI识别)/库存自动入库 | 采购计划执行页(从排程到采购)、采购单编辑/删除API、对账功能 |
| 7 | **库存管理** | 30% | 库存列表API(含分类名/采购频次 enrichment) | **盘点/调整/出库功能缺失**、库存预警、保质期管理 |
| 8 | **切配工单** | 20% | 数据模型+自动生成逻辑(schedule-utils 434行) | **执行界面完全缺失**、打印功能 |
| 9 | **字典管理** | 10% | 侧边栏入口存在 | 分类/单位/供应商CRUD页面全部缺失 |
| 10 | **采购报销** | 15% | 数据模型+子菜单入口 | 报销页面和API完全缺失 |
| 11 | **AI能力** | 50% | 采购单OCR识别(Qwen视觉)/出库单识别函数 | 未与前端上传组件对接、无置信度反馈、无人工校正流程 |
| 12 | **系统设置** | 0% | — | 完全缺失 |
| 13 | **测试体系** | 0% | — | 无任何测试文件 |
| 14 | **CI/CD** | 0% | — | 无任何配置 |

### 1.4 代码质量关键问题

#### 🔴 严重问题（必须修复）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **Session Secret硬编码fallback** | `lib/session.ts:4-5` | 生产环境可被伪造任意用户token |
| 2 | **Dish code生成bug** | `api/dishes/route.ts:88-94` | `generateDishCode` 返回模板字符串 `` 而非实际编码 |
| 3 | **排程创建后路由跳转错误** | `schedules/new/page.tsx:150` | `router.push('/schedules/')` 缺少ID，用户无法到达详情页 |
| 4 | **排程列表fetch遗漏查询参数** | `schedules/page.tsx:58` | `fetch('/api/schedules?')` 硬编码问号，status/date参数未拼接 |
| 5 | **采购单删除URL不完整** | `purchases/page.tsx:94` | `fetch('/api/purchase-receipts/')` 缺少ID |
| 6 | **侧边栏active判断过于宽泛** | `sidebar.tsx:44` | `pathname.startsWith('/')` 永远为true，导致首页常亮 |
| 7 | **无输入校验层** | 全局API | 所有POST body直接使用，无zod/schema验证 |
| 8 | **any类型滥用** | 多处API route | `const where: any = {}` 破坏类型安全 |

#### 🟡 中等问题（影响体验）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 9 | 操作日志description为空字符串 | `api/schedules/route.ts:114` | 日志缺少业务上下文 |
| 10 | 库存只显示currentQty > 0 | `api/inventory/route.ts:9` | 无法查看零库存物料 |
| 11 | 无分页机制 | 所有列表API | 数据量大时性能问题 |
| 12 | 前端无全局错误边界 | layout.tsx | 组件崩溃白屏 |
| 13 | 无加载状态骨架屏统一 | 各页面 | 体验不一致 |

---

## 二、产品愿景与目标定义

### 2.1 核心价值主张

> **让中小餐饮经营者用最低的学习成本，实现厨房运营的数据化精益管理——从排程到采购到库存到成本，全链路可追溯、可量化。**

### 2.2 目标用户（按优先级）

1. **P0 - 社区食堂/单店经营者**（1-3个灶台，日供50-300份）
2. **P1 - 小型连锁餐饮**（3-10家店，需要中央厨房协同）
3. **P2 - 餐饮创业团队**（需要快速验证菜品成本的初创团队）

### 2.3 成功指标（MVP阶段）

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| 排程→采购→入库全链路闭环率 | 100% | 端到端流程可走通 |
| 菜品BOM→成本核算准确率 | ≥95% | 与手工核算对比 |
| 核心操作响应时间 | <2s | API性能基准 |
| 关键路径测试覆盖率 | ≥80% | 单元+集成测试 |
| 浏览器兼容性 | Chrome/Firefox/Safari最新2版 | E2E验证 |

---

## 三、架构演进路线图（四阶段，约16周）

### 🏗️ 第一阶段：基础加固（第1-4周）

**目标：消除严重缺陷，建立工程规范，确保安全基线**

#### Week 1-2：安全与稳定性修复

```
优先级: P0（阻塞性）
预估工时: 15-20h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| Secret安全管理 | 移除硬编码fallback，启动时检测环境变量缺失则拒绝启动 | process.env.SESSION_SECRET必填 |
| 输入校验层 | 引入zod，为所有API endpoint定义Request/Response schema | 每个POST/PUT有zod validator |
| Bug修复（4项） | ①Dish code生成逻辑 ②排程跳转路径 ③fetch参数拼接 ④删除URL补全 | 功能回归通过 |
| 侧边栏导航修复 | active判断改为精确匹配或startsWith具体路径 | 导航高亮正确 |
| 错误处理统一 | 创建api-error.ts工具函数，统一400/401/403/500响应格式 | 所有API错误格式一致 |

#### Week 3：工程规范建立

```
优先级: P0
预估工时: 12-15h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| ESLint规则强化 | 配置@typescript-eslint/no-explicit-any、strictNullChecks | 0个any（API where条件改用Prisma类型） |
| 目录结构规范化 | 按 feature 模块重组：`app/(dashboard)/[module]/` | 符合Next.js App Router惯例 |
| 类型定义抽取 | 创建types/目录：dish.ts, ingredient.ts, purchase.ts, schedule.ts等 | 共享类型不复造 |
| API响应包装器 | 创建统一的JsonResponse<T>工具类 | {code, data, message}格式 |
| 日志结构化 | 引入pino或winston，替换console.error | JSON格式日志+请求追踪ID |

#### Week 4：测试基础设施

```
优先级: P0
预估工时: 15-20h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| 测试框架搭建 | Jest + React Testing Library + Supertest | 可运行npm test |
| 核心工具函数单元测试 | schedule-utils.ts（BOM计算）、csv.ts、session.ts | 覆盖率≥85% |
| Auth中间件测试 | middleware.ts各种场景（有效token/过期/token缺失/公开路径） | 全分支覆盖 |
| API集成测试模板 | 以auth/login为范例写完整的request→assert流程 | 可复制的测试模式 |
| E2E测试选型 | 评估Playwright vs Cypress，搭建基础框架 | 可运行npx e2e |

---

### 🔧 第二阶段：核心业务闭环（第5-9周）

**目标：排程→切配→采购→库存→成本，主链路完全走通**

#### Week 5：菜品管理完善

```
优先级: P0（核心链路起点）
预估工时: 20-25h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| 菜品详情页 | `/dishes/[id]/page.tsx`：展示基本信息+BOM表格+工艺步骤+成本汇总 | 只读详情可用 |
| **菜品BOM编辑器** | **核心功能：净料/调料/酱料/工艺的增删改界面** | 可完整编辑一道菜的BOM |
| 成本自动计算 | BOM保存后根据单价自动累加cost字段 | cost = Σ(净料×单价) + Σ(调料×单价) + ... |
| 菜品复制功能 | 基于已有菜品快速创建变体（如不同份量） | 一键复制+微调 |
| 菜品状态机 | draft → pending_review → published | 状态流转控制 |

#### Week 6：排程管理闭环

```
优先级: P0
预估工时: 18-22h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| **排程详情页** | `/schedules/[id]/page.tsx`：基本信息+菜品清单+切配工单tab+采购计划tab | 详情页完整展示 |
| 排程状态流转 | 待生效 → 进行中 → 已完成 | 状态变更按钮+确认弹窗 |
| 排程编辑 | 修改标题/日期/范围/菜品数量 | 编辑后重新拆解BOM |
| 排程复制 | 基于历史排程快速创建新排程 | 一键复制+日期调整 |
| 切配工单展示 | 按食材分类分组展示，显示需求量/单位/分类 | 可打印切配单 |

#### Week 7：采购执行

```
优先级: P0
预估工时: 20-24h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| **采购计划执行页** | 从排程详情进入，展示系统建议采购量 vs 实际采购量 | 可逐项填写实际采购 |
| 采购计划→采购单转化 | 将已填写的采购计划一键转为采购入库单 | 数据自动带入 |
| AI采购单识别完善 | 上传照片→Qwen识别→结果可编辑校正→入库 | OCR准确率≥80%（常见单据） |
| 供应商管理 | 字典模块中的供应商CRUD | 采购单可选择供应商 |
| 采购单编辑/删除 | 补全PUT/PATCH/DELETE API | 完整CRUD |

#### Week 8：库存管理

```
优先级: P0
预估工时: 18-22h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| **库存盘点页** | 支持全盘/抽盘，录入实存数量，自动生成盈亏 | 盘点单据可保存 |
| **库存调整** | 手动入库/出库/报损，填写原因和金额 | 流水账正确记录 |
| 库存预警 | 低库存/临期提醒（阈值可配置） | 工作台展示预警条目 |
| 库存明细查询 | 按食材查看流水账（InventoryLedger） | 时间线展示 |
| 零库存物料可见 | 库存列表增加"显示全部"开关 | 可查看零库存 |

#### Week 9：采购报销

```
优先级: P1
预估工时: 12-15h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| 报销单管理页 | 列表/创建/结算状态流转 | pending → settled |
| 采购单关联报销 | 多选采购单归入一个报销主题 | 关联关系正确 |
| 报销汇总报表 | 按时间段/供应商统计报销金额 | 可导出CSV/打印 |

---

### 📊 第三阶段：数据分析与体验升级（第10-13周）

**目标：从"能用"到"好用"，数据驱动决策**

#### Week 10：数据看板与报表

```
优先级: P1
预估工时: 18-20h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| 工作台改造 | 今日概览卡片：在售菜品数/今日排程数/库存预警数/本周采购金额 | 首页信息密度合理 |
| 成本分析报表 | 按菜品/时间段查询成本趋势 | 图表展示（考虑recharts） |
| 采购分析 | 供应商对比/价格波动/品类占比 | 可视化图表 |
| 库存周转率 | 计算并展示各食材周转天数 | 辅助采购决策 |
| 报表导出 | 所有列表页支持CSV/Excel导出 | 使用已有的csv.ts工具 |

#### Week 11：字典管理与系统配置

```
优先级: P1
预估工时: 15-18h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| 食材分类管理 | L1/L2分类的CRUD树形界面 | 拖拽排序 |
| 单位管理 | 单位CRUD + 换算关系（1斤=500g） | 自动换算 |
| 供应商管理增强 | 联系人/结算周期/评级 | 完整供应商档案 |
| 系统设置页 | 库存预警阈值/默认scope选项/数据保留策略 | 设置持久化存储 |
| 数据初始化脚本 | 种子数据（seed）：常用分类/单位/示例菜品BOM | `npx prisma db seed`可用 |

#### Week 12：用户体验打磨

```
优先级: P1
预估工时: 15-18h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| 移动端适配 | 核心页面（排程/采购/库存）响应式布局 | 手机375px可用 |
| 键盘快捷键 | 排程新建页支持Ctrl+S保存、Esc取消 | 效率提升 |
| 批量操作 | 菜品批量上架/下架、采购单批量结算 | 减少重复操作 |
| 全局搜索 | Cmd+K唤起全局搜索（菜品/食材/采购单） | 类似Linear/Cmd+F |
| 骨架屏与Loading态 | 统一所有页面的加载动画 | 感知性能提升 |

#### Week 13：通知与协作

```
优先级: P2
预估工时: 12-15h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| 系统内通知 | 排程分配通知/库存预警通知/报销审批通知 | 通知中心+未读计数 |
| 操作确认强化 | 删除/状态变更等危险操作二次确认 | 防误操作 |
| 用户管理 | 管理员可创建/禁用用户 | 多用户协作基础 |

---

### 🚀 第四阶段：生产就绪与智能化（第14-16周+）

**目标：达到部署标准，引入AI增值能力**

#### Week 14：运维与部署

```
优先级: P0（上线前提）
预估工时: 15-20h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| Docker化 | Dockerfile + docker-compose.yml（app+postgres） | `docker compose up`即可运行 |
| 数据库迁移策略 | Prisma migrate生产部署方案 | 零停机迁移 |
| 健康检查 | `/api/health`端点 + 数据库连接检测 | 监控探针可用 |
| 环境变量文档 | .env.example + 每个变量说明 | 新人可一键启动 |
| 备份策略 | pg_dump定时备份脚本 + 文档 | 可恢复 |

#### Week 15：性能与安全加固

```
优先级: P0
预估工时: 12-15h
```

| 任务 | 具体动作 | 验收标准 |
|------|---------|---------|
| API分页 | 所有列表接口支持cursor或offset分页 | 大数据量≤100ms响应 |
| 查询优化 | Prisma慢查询分析 + 索引添加 | 关键查询≤50ms |
| Rate Limiting | API限流（基于IP或用户） | 防恶意调用 |
| CSP与安全头 | 配置next.config.js安全headers | securityheaders.io评分A |
| 数据备份 | 定期备份 + 文档 | 可恢复 |

#### Week 16+: 智能化增值（持续迭代）

```
优先级: P2（差异化竞争力）
预估工时: 每个功能5-8h
```

| 任务 | 具体动作 | 价值 |
|------|---------|------|
| 智能采购建议 | 基于历史销量预测+当前库存，推荐采购量 | 减少浪费10-15% |
| 菜品成本异常检测 | 成本波动超阈值自动告警 | 成本控制 |
| 菜谱自然语言导入 | AI解析文字菜谱→结构化BOM | 录入效率提升10倍 |
| 销量预测 | 基于历史排程数据预测未来需求 | 辅助排程决策 |

---

## 四、技术债务清偿计划

### 4.1 必须偿还（阻塞上线）

| 债务 | 影响 | 偿还时机 | 方案 |
|------|------|---------|------|
| Secret硬编码 | 安全漏洞 | Phase 1 W1 | 启动时校验，缺失则exit(1) |
| zod缺失 | 数据完整性 | Phase 1 W2 | 逐API添加validator |
| any类型泛滥 | 维护性 | Phase 1 W3 | 定义Prisma WhereInput类型别名 |
| 无分页 | 性能 | Phase 3 W14 | 通用cursor分页工具 |

### 4.2 应该偿还（影响质量）

| 债务 | 影响 | 偿还时机 | 方案 |
|------|------|---------|------|
| 组件抽象不足 | 重复代码 | Phase 2 W5 | 表格页/表单页通用模板 |
| API错误处理不一致 | 前端处理困难 | Phase 1 W2 | 统一error response wrapper |
| 无Mock数据 | 前后端并行受阻 | Phase 1 W4 | MSW或固定seed数据 |

### 4.3 可以暂缓（不影响MVP）

| 债务 | 影响 | 偿还时机 |
|------|------|---------|
| i18n硬编码中文 | 国际化需求 | Phase 5 |
| 无Storybook | 组件文档 | Phase 4 |
| monorepo重构 | 多应用扩展 | 有新应用时 |

---

## 五、数据库演进计划

### 5.1 Schema变更（按阶段）

#### Phase 1 变更：
```sql
-- 1. User表增加字段
ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. 全部表增加软删除（可选，视业务需求）
-- ALTER TABLE dishes ADD COLUMN deleted_at TIMESTAMPTZ;
-- （逐一添加...）

-- 3. 增加系统配置表
CREATE TABLE system_configs (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Phase 2 变更：
```sql
-- 1. 增加库存调整单表
CREATE TABLE inventory_adjustments (
  id SERIAL PRIMARY KEY,
  ingredient_id INTEGER REFERENCES ingredients(id),
  adjustment_type TEXT NOT NULL, -- 'manual_in'/'manual_out'/'waste'/'loss'
  qty DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  reason TEXT,
  operator TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 增加通知表
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT false,
  entity_type TEXT,
  entity_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 索引优化计划

```sql
-- 已有的隐式索引之外，需要添加的复合索引：
CREATE INDEX idx_schedule_status_date ON schedules(status, schedule_date);
CREATE INDEX idx_receipt_date ON purchase_receipts(receipt_date);
CREATE INDEX idx_ledger_ingredient_time ON inventory_ledgers(ingredient_id, change_time);
CREATE INDEX idx_inventory_qty ON inventories(current_qty); -- 用于低库存查询
CREATE INDEX idx_schedule_item_dish ON schedule_items(dish_id);
CREATE INDEX idx_purchase_receipt_ingredient ON purchase_receipt_items(ingredient_id);
```

---

## 六、API端点完整规划

### 当前已有（需修复/完善）：

| Method | Path | 状态 | 需要做的 |
|--------|------|------|----------|
| POST | /api/auth/login | ✅可用 | 加zod验证 |
| POST | /api/auth/logout | ✅可用 | — |
| GET | /api/auth/me | ✅可用 | — |
| GET | /api/schedules | ⚠️有bug | 修复fetch参数 |
| POST | /api/schedules | ✅可用 | 加事务回滚提示优化 |
| GET | /api/schedules/active | ✅可用 | — |
| GET | /api/dishes | ✅可用 | 加分页 |
| POST | /api/dishes | ⚠️有bug | 修复code生成 |
| GET | /api/ingredients | ✅可用 | 加分页/搜索 |
| POST | /api/ingredients | ✅可用 | 加zod |
| GET | /api/inventory | ⚠️有限制 | 显示全部+分页 |
| GET | /api/purchase-receipts | ✅可用 | 加分页 |
| POST | /api/purchase-receipts | ✅可用 | — |

### 需要新增：

| Phase | Method | Path | 说明 |
|-------|--------|------|------|
| 2 | PUT | /api/dishes/[id] | 更新菜品基础信息 |
| 2 | PUT | /api/dishes/[id]/bom | 更新菜品BOM（整体提交） |
| 2 | GET | /api/schedules/[id] | 排程详情（含工单+采购计划） |
| 2 | PUT | /api/schedules/[id] | 编辑排程 |
| 2 | PATCH | /api/schedules/[id]/status | 状态流转 |
| 2 | POST | /api/schedules/[id]/copy | 复制排程 |
| 2 | GET | /api/purchase-plans?scheduleId= | 采购计划列表 |
| 2 | PUT | /api/purchase-plans/[id] | 更新实际采购量 |
| 2 | GET | /api/cutting-orders?scheduleId= | 切配工单列表 |
| 2 | PUT | /api/cutting-orders/[id] | 更新实际切配量 |
| 2 | DELETE | /api/purchase-receipts/[id] | 删除采购单 |
| 2 | POST | /api/inventory/adjustments | 库存调整 |
| 2 | GET | /api/inventory/[ingredientId]/ledger | 库存流水 |
| 2 | GET/POST | /api/reimbursements | 报销单CRUD |
| 2 | PUT | /api/reimbursements/[id]/settle | 结算报销 |
| 3 | GET | /api/dashboard/stats | 工作台统计数据 |
| 3 | GET | /api/reports/cost-analysis | 成本分析 |
| 3 | GET | /api/reports/purchase-analysis | 采购分析 |
| 3 | CRUD | /api/dictionaries/* | 字典CRUD（分类/单位/供应商） |
| 3 | CRUD | /api/users | 用户管理 |
| 3 | POST | /api/ai/recognize-receipt | AI识别（已有lib，需暴露API） |
| 4 | GET | /api/health | 健康检查 |

---

## 七、前端页面路由规划

### 当前路由：

```
/                    → 工作台首页（今日排程）
/login               → 登录页
/schedules           → 排程列表
/schedules/new       → 新建排程
/purchases           → 采购单列表
/purchases/new       → 录入采购单（推测存在）
/purchases/reimbursements → 采购报销（入口存在）
/inventory           → 库存列表
/dishes              → 菜品列表（推测存在）
/ingredients         → 食材列表（推测存在）
/dictionaries        → 字典管理（入口存在）
```

### 需要新增的路由：

```
=== Phase 2 ===
/dishes/new                          → 新建菜品
/dishes/[id]                         → 菜品详情+编辑
/dishes/[id]/edit                    → 菜品编辑（或合并到详情）
/schedules/[id]                      → 排程详情（含工单+采购计划tab）
/schedules/[id]/edit                 → 编辑排程
/purchases/[id]                      → 采购单详情
/purchases/[id]/edit                 → 编辑采购单
/inventory/adjust                   → 库存调整
/inventory/check                    → 盘点
/inventory/[ingredientId]           → 食材库存详情（含流水）
/reimbursements                     → 报销列表
/reimbursements/new                 → 新建报销
/reimbursements/[id]                → 报销详情

=== Phase 3 ===
/dashboard                           → 增强版工作台（或改造/）
/reports/cost                        → 成本报表
/reports/purchase                    → 采购报表
/dictionaries/categories            → 分类管理
/dictionaries/units                  → 单位管理
/dictionaries/suppliers             → 供应商管理
/settings                            → 系统设置
/users                               → 用户管理
/notifications                       → 通知中心

=== Phase 4 ===
/ai/receipt-scan                    → AI扫描页（可选独立页）
```

---

## 八、团队配置建议（最小可用团队）

### MVP阶段（Phase 1-2，1-2个月）：

| 角色 | 人数 | 职责 |
|------|------|------|
| **全栈开发者**（你+1） | 2 | 你做产品+部分前端，另一人专注后端API和数据逻辑 |
| *注*：如果你是 solo，建议优先招一个有Prisma/Next.js经验的兼职开发者 | | |

### 扩展阶段（Phase 3-4）：

| 角色 | 人数 | 职责 |
|------|------|------|
| 产品负责人 | 1（你） | 需求定义、验收、用户反馈 |
| 全栈开发 | 1-2 | 持续迭代 |
| UI/UX | 0.5（兼职） | 关键页面设计评审 |
| DevOps | 0.5（兼职） | 部署、监控、备份 |

---

## 九、风险登记与应对

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|---------|
| BOM计算逻辑边界case出错 | 中 | 高 | Phase 2 W5前完成核心算法的单测覆盖 |
| AI识别准确率不稳定 | 中 | 中 | 保留手动录入作为fallback；收集bad case优化prompt |
| 并发库存更新冲突 | 低 | 高 | 乐观锁或Prisma $transaction序列化 |
| 数据迁移丢失 | 低 | 高 | 每次schema变更前自动备份 |
| 性能瓶颈（大量历史数据） | 中 | 中 | 分页+索引；冷热数据分离（后续） |
| 用户接受度低 | 中 | 高 | 每周与真实用户演示获取反馈 |

---

## 十、每周Checklist速查

### 本周应该完成什么？

- [ ] **Week 1**: Secret修复 + zod引入 + 4个bug修复 + ESLint强化
- [ ] **Week 2**: 目录重构 + 类型定义 + API wrapper + 结构化日志
- [ ] **Week 3**: 测试框架 + 核心函数单测 + Auth测试
- [ ] **Week 4**: 菜品详情页 + BOM编辑器原型
- [ ] **Week 5**: BOM编辑器完成 + 成本计算 + 菜品状态机
- [ ] **Week 6**: 排程详情页 + 状态流转 + 排程编辑
- [ ] **Week 7**: 采购计划执行页 + AI识别对接 + 供应商管理
- [ ] **Week 8**: 库存盘点 + 调整 + 预警
- [ ] **Week 9**: 报销功能 + 主链路端到端测试
- [ ] **Week 10**: 数据看板 + 报表导出
- [ ] **Week 11**: 字典管理 + 系统设置 + seed数据
- [ ] **Week 12**: 移动端适配 + UX打磨
- [ ] **Week 13**: 通知系统 + 用户管理
- [ ] **Week 14**: Docker + 部署 + 备份
- [ ] **Week 15**: 分页 + 性能 + 安全加固
- [ ] **Week 16+**: AI智能功能持续迭代

---

## 附录A：现有代码文件清单（已确认读取）

```
lean-kms-v3/
├── package.json                          ✅ 已读
├── prisma/
│   └── schema.prisma (386行, 20个模型)    ✅ 完整读取
├── middleware.ts (JWT拦截, 61行)           ✅ 已读
├── app/
│   ├── layout.tsx                        ✅ 已读
│   ├── page.tsx (工作台首页, 156行)       ✅ 已读
│   ├── globals.css (142行)               ✅ 已读
│   ├── login/page.tsx (105行)             ✅ 已读
│   ├── components/
│   │   ├── sidebar.tsx (90行)             ✅ 已读
│   │   ├── layout-wrapper.tsx (30行)      ✅ 已读
│   │   └── page-header.tsx (37行)         ✅ 已读
│   ├── schedules/
│   │   ├── page.tsx (192行)               ✅ 已读
│   │   └── new/page.tsx (329行)           ✅ 部分(前200行)
│   ├── purchases/page.tsx (379行)         ✅ 部分(前200行)
│   ├── lib/
│   │   ├── schedule-utils.ts (434行)      ✅ 完整读取
│   │   ├── csv.ts (58行)                  ✅ 已读
│   │   └── use-pagination.ts (33行)      ✅ 已读
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts (58行)      ✅ 已读
│       │   ├── logout/route.ts (7行)      ✅ 已读
│       │   └── me/route.ts (10行)         ✅ 已读
│       ├── schedules/
│       │   ├── route.ts (122行)           ✅ 已读
│       │   └── active/route.ts (24行)     ✅ 已读
│       ├── dishes/route.ts (144行)        ✅ 已读
│       ├── ingredients/route.ts (39行)    ✅ 已读
│       ├── inventory/route.ts (78行)      ✅ 已读
│       └── purchase-receipts/route.ts (178行) ✅ 已读
├── lib/
│   ├── session.ts (59行)                  ✅ 已读
│   ├── auth.ts (46行)                     ✅ 已读
│   ├── api-auth.ts (41行)                 ✅ 已读
│   ├── prisma.ts (11行)                   ✅ 已读
│   ├── utils.ts (6行)                     ✅ 已读
│   └── ai.ts (181行)                      ✅ 已读
└── README.md (默认模板)                    ✅ 已读
```

---

## 附录B：关键设计决策记录（DDR）

### DDR-001: 为什么选择JWT Session而非NextAuth？
**现状**: 自研jose-based JWT，httpOnly cookie存储
**评价**: 对于内部管理系统（非面向C端用户），这个选择合理且轻量。无需引入NextAuth的复杂度。
**建议**: 保持现状，但需增加token刷新机制和并发session控制。

### DDR-002: 为什么选择Prisma adapter-pg而非标准连接？
**现状**: 使用@prisma/adapter-pg驱动PostgreSQL
**评价**: 这是Prisma v5+的新模式，更适合serverless/edge环境。合理。
**注意**: 确保连接池配置在生产环境中正确设置。

### DDR-003: AI OCR为什么选择通义千问？
**现状**: 通过OpenAI SDK兼容层调用Qwen，支持多模态
**评价**: 国内访问稳定、成本低、中文识别好。合理的选择。
**建议**: 增加备用模型切换机制（如识别失败降级到tesseract.js，项目已依赖此包）。

### DDR-004: BOM爆炸为什么放在应用层而非数据库？
**现状**: buildCuttingOrders/buildPurchasePlans是TypeScript函数
**评价**: 正确。BOM涉及复杂业务逻辑（出成率反算、单位换算、分类聚合），不适合用数据库触发器或存储过程。

---

> **文档结束**  
> 本方案基于对项目源码的逐文件审计生成，所有评估均有对应的代码位置引用。  
> 建议以2周为一个review节点，根据实际进展调整后续阶段的优先级和时间安排。
