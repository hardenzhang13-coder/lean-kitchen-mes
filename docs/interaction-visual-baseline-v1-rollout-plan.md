# 交互视觉基线 v1 — 落地改造计划

> 制定日期：2026-11-14
> 依据基线：`docs/interaction-visual-baseline-v1.md`（当前唯一基线，历史规范文档一律作废）
> 适用阶段：试运行期（2026-11 已上线）→ 按批次替换剩余页面
> 状态：批次 0 已完成（见 `memory-bank/progress.md` 2026-11-14），批次 1–4 待执行

---

## 1. 目标

把「交互视觉基线 v1」从文档约束变成可被工具强制执行的规则，使系统在新功能优化期不再产生新的形态分裂。

三条硬指标：

1. 业务页面不再直接声明弹窗像素宽度，一律走 `AppDialogContent` 语义尺寸。
2. 正文与辅助信息不小于 12px。
3. 基线规则从 `warn` 升级为 `error`，新增代码无法绕过。

---

## 2. 当前合规状态（2026-11-14 基线）

`npm run lint`：**0 error / 62 warning / 35 个文件**。

| 规则 | 命中数 | 涉及文件 | 性质 |
|---|---:|---:|---|
| `no-restricted-syntax`（弹窗像素宽度） | 31 | 22 | 基线违规，可机械替换 |
| `no-restricted-syntax`（字号 < 12px） | 16 | 11 | 基线违规，需逐处判断语义 |
| `react-hooks/set-state-in-effect` | 11 | 10 | 迁移期临时降级，非基线违规 |
| `react-hooks/exhaustive-deps` | 1 | 1 | `app/production-plans/[id]/page.tsx` |
| `react-hooks/immutability` | 1 | 1 | `app/purchases/reimbursements/page.tsx` |
| `@typescript-eslint/no-explicit-any` | 1 | 1 | `components/ui/calendar.tsx`（shadcn 原语，需覆盖式屏蔽） |
| `@typescript-eslint/no-unused-vars` | 1 | 1 | `scripts/audit-schedule.ts` |

> 说明：`no-restricted-syntax` 两条子规则当前在 `eslint.config.mjs` 中为 `warn`，按基线治理规则第 3 条，需在批次 4 结束后升级为 `error`。

---

## 3. 改造批次

### 批次 0（已完成）：组件层与试点模块

- 抽取业务组件层：`PageShell` / `PageHeader` / `AppDialogContent` / `FormField` / `FormSection` / `ListToolbar` / `DataTable` / `StatusBadge` / `InfoTile` / `SectionTabs` / `EmptyState` / `LoadingState` / `RecordSheet` / `FormControls` / `useRecordForm`
- 落地范围：食材库（5 类清单 + 详情抽屉）、排程、生产计划、库存、设置模块
- 交付物：`/ui-kit` 可视验收页 + 10 个组件单测
- 提交：`feat(ui): 交互视觉基线 v1 落地与净菜包装前端接入`

### 批次 1：弹窗语义尺寸统一（31 处）

**范围**：仅 `no-restricted-syntax` 的弹窗宽度子规则，不改变任何业务逻辑与文案。

**改法**：
1. 删除 `<DialogContent className="... max-w-[Npx] ...">` 中的 `max-w-*`
2. 改用 `<AppDialogContent size="...">`
3. 尺寸映射：

| 当前像素宽度 | 语义尺寸 | 用途 |
|---|---|---|
| `max-w-[400px]` | `compact` | 删除、作废、清空等短确认 |
| `max-w-[520px]` ~ `max-w-[600px]` | `form` | 常规单列表单、短信息确认 |
| `max-w-[760px]` ~ `max-w-[900px]` | `wide` | 多列表单、预览、复杂选择 |
| `max-w-[1000px]` 以上 | `workbench` | 左右布局、批量确认、高密度编辑 |

4. 映射前逐个核对原宽度落在哪一档；跨档时按**就近不缩小**原则选择，并同步更新 `/ui-kit` 样张。

**涉及文件**（22 个）：

```
app/components/dish-form/bom-picker-dialog.tsx      app/components/dish-form/index.tsx
app/components/dish-form/process-editor.tsx         app/components/dishes/dish-sheet-detail.tsx
app/components/schedule/sales-record-dialog.tsx     app/dishes/page.tsx
app/ingredients/minor/page.tsx                      app/ingredients/raw/page.tsx
app/ingredients/sauce/page.tsx                      app/ingredients/seasoning/page.tsx
app/inventory/outbound/[id]/page.tsx                app/purchases/purchases-view.tsx
app/schedules/[id]/page.tsx                         app/schedules/new/page.tsx
app/settings/categories/page.tsx                    app/settings/classes/page.tsx
app/settings/stores/page.tsx                        app/settings/suppliers/page.tsx
app/settings/units/page.tsx                         app/settings/users/page.tsx
```

**验收**：三档宽度（1280 / 1440 / 1920）下弹窗不压缩字段、不横向滚动；`eslint` 该子规则命中归零。

**风险**：弹窗内容若依赖原像素宽度排版，改为语义尺寸后可能出现换行或滚动。逐个截图比对，不接受「看起来差不多」。

---

### 批次 2：字号下限统一（16 处）

**范围**：`text-[9px]` / `text-[10px]` / `text-[11px]` → `text-xs`（12px）。

**涉及文件**（11 个）：

```
app/components/inventory/ledger-tab.tsx             app/components/schedule/sales-record-dialog.tsx
app/components/schedule/sales-record-panel.tsx      app/ingredients/page.tsx
app/inventory/outbound/[id]/page.tsx                app/inventory/outbound/new/page.tsx
app/page.tsx                                        app/schedules/[id]/edit/page.tsx
app/schedules/new/page.tsx
```

**改法**：
1. 表格内的辅助标签、徽标、列说明统一改为 `text-xs`，配合 `text-muted-foreground` 保持层级
2. 数字类字段保留等宽字体 + 稳定列宽，不靠缩小字号压缩
3. 密集表格若因此变高，改用 `DataTable density="dense"`（行高 44px）而不是更小字号

**验收**：基线第 3.2 条「正文不得小于 12px」全站成立；列表扫读密度不回退。

---

### 批次 3：React Hooks 规范化（13 处）

**范围**：11 处 `set-state-in-effect` + 1 处 `exhaustive-deps` + 1 处 `immutability`。这部分**不是**视觉基线违规，是 React 19 下的稳健性问题，但当前被 `warn` 掩盖，容易在迭代中扩散，一并清理。

**典型位置**：`app/schedules/page.tsx`（读 URL query 后 `setModule`）、`app/production-plans/[id]/page.tsx`（`fetchData` 依赖缺失）、`app/inventory/*`、`app/purchases/reimbursements/new/page.tsx` 等。

**改法**：
1. URL query 驱动的初始状态 → 用 `useState(() => 初始值)` 惰性初始化，不放 `useEffect`
2. 派生状态 → `useMemo` 替代 `useState` + `useEffect` 同步
3. 数据拉取 → 事件回调或路由变化驱动，并在 `useCallback` 中稳定 `fetchData`，补齐 `exhaustive-deps`
4. `immutability` 告警 → 检查是否在 `useEffect` 中直接修改数组/对象，改为构造新值

**验收**：`eslint` 三条 react-hooks 规则命中归零；页面切换无「先空后闪」。

---

### 批次 4：残余清理与规则升级（3 处 + 规则升档）

| 位置 | 问题 | 处理 |
|---|---|---|
| `components/ui/calendar.tsx:135` | `any` | shadcn 原语自带，改为 `unknown` + 局部断言或加文件级 `eslint-disable` 注释并说明原因；`components/ui/` 属 CLI 管理目录，改动需谨慎 |
| `scripts/audit-schedule.ts:56` | `srcIds` 未使用 | 删除该变量或补上其用途 |
| `eslint.config.mjs` | 基线规则仍是 `warn` | 把 `no-restricted-syntax` 两条子规则从 `warn` 升为 `error`；`react-hooks/*` 三条在存量清零后同样升 `error`；`no-explicit-any` 全局项保留 `warn`（shadcn 目录豁免），`app/api/**` 与 `lib/**` 已是 `error` |

**验收**：新增代码无法再引入基线违规形态。

---

## 4. 回归清单（每批次必跑）

四条核心链路 + 组件层：

1. **排程**：列表 → 新建 → 详情 → 编辑 → 打印
2. **采购**（当前试运行锁定，改动后需解锁验证一次）：列表 → 录入 → 报销
3. **生产计划**：列表 → 新建 → 详情 → 完成生产 → 标签打印
4. **库存**：当前库存 → 出库单新建 → 详情 → 作废回滚 → 台账
5. **组件层**：`/ui-kit` 三档宽度目视检查 + 组件单测（`npm test`）

通用门禁：`npx tsc --noEmit` → `npm run lint` → `npm test` →（涉 schema/依赖时）`npm run build`。

---

## 5. 治理规则（长期有效）

1. 新页面只能由基线第 6 章的四种页面模式组合而成，不新造基础操作形态。
2. 业务页面不得直接定义状态色、弹窗像素宽度、表单分区列数。
3. 新增组件变体必须同时提供使用场景、桌面布局表现和状态样张（同步 `/ui-kit`）。
4. 旧规范文档（`ui-ux-standardization-*.md`、`component-layer-optimization-spec.md`、`table-form-optimization-spec.md`、`dialog-input-table-style-supplement.md`、`ui-audit-report.md`）一律视为历史输入，不得再作为执行依据。
5. 每轮迭代重点回归上述四条核心链路。

---

*创建于 2026-11-14 | 与 `docs/interaction-visual-baseline-v1.md` 配套*
