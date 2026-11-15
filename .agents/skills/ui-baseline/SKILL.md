---
name: ui-baseline
description: 新增或修改页面、弹窗、表格、表单、列表筛选等任何前端 UI 时使用。强制遵守 docs/interaction-visual-baseline-v1.md：页面骨架、语义弹窗尺寸、表单分组、列表与分页、字号下限、状态展示，避免新增 lint 违规与视觉漂移。
---

# 交互视觉基线 v1

唯一基线：`docs/interaction-visual-baseline-v1.md`（视觉交互）。工程与架构契约（枚举字典、模块形态、能力复用边界）见 `docs/system-iteration-foundation-v1.md`。所有更早的 UI 规范文档（ui-ux-standardization-*、component-layer-optimization-spec 等）一律作废，不得作为依据。

## 页面骨架

- 页面最外层用 `PageShell`，标题区用 `PageHeader`。
- 只允许四种页面模式组合，不新造基础操作形态。
- 业务页面**不得**自行定义：状态色、弹窗像素宽度、表单分区列数。

## 弹窗

- 一律用 `AppDialogContent` 的语义尺寸：`compact` / `form` / `wide` / `workbench`。
- 禁写 `max-w-[...]`；ESLint 会对 `DialogContent` 的像素宽度告警。
- 简单 CRUD 用 `FormDialog`；复杂向导才用自定义多段弹窗。
- 删除等二次确认用标准 Dialog，不用原生 `confirm()`。

## 表单

- 字段用 `FormField`，分组用 `FormSection`（`cols` 1–4）。
- 分组只靠**边框 + 标题**建立层级，不使用浅色背景分组。
- 提交中禁用按钮；失败保留用户输入。

## 列表

- 工具栏统一 `ListToolbar`（搜索 + 筛选 children + 重置）。
- 表格用 `DataTable`；分页用 `Pagination`。
- 分页默认只显示「上一页 / 当前页 / 下一页」，不显示每页条数与数据区间。
- **已登记例外**：主数据清单（食材库 5 个清单、供应商、门店、单位、分类等）展示 `totalLabel` 与 `showPageSize`。新增例外必须先改基线文档，再改代码。
- 字段标题**不携带单位**，单位由数值行表达（列名 `净料单价`，值 `¥3.56/斤`）。
- 表头加粗；字段单行完整显示，不截断、不靠换行压缩列宽；列过多时优先删非核心列，允许表格局部横向滚动。
- 点击整行进入详情；操作列不重复放「查看」按钮。
- 操作列直接展示当前行可执行的全部业务动作图标，**不折叠进「更多」菜单**。

## 详情

- 半屏详情用 `RecordSheet`（50vw）+ `RecordActions`（危险 / 次级 / 主操作三槽）。
- 内容用 `DetailSection` 分组、组内用 `InfoCell` 双列信息单元，不连续堆叠单行长列表。
- 抽屉内参照列表用精简翻页。
- 只读 ↔ 编辑态切换时若表单 dirty，关闭必须经 `useRecordGuard` + `DiscardChangesDialog` 确认，不允许静默丢弃。
- 加载失败要说明原因并给出下一步，不空转。

## 复制

- 复制是**新建动作**：以现有档案回填全部字段，名称追加「-副本」绕开重名拦截，提交不带原记录 id。
- 从详情页触发时，复制表单以新弹窗叠在详情抽屉之上；提交成功后关闭全部弹窗。
- 编排统一走 `useRecordCopy`（`lib/client/use-record-copy.ts`），不在页面里各写一遍 `buildCopyData`。

## 连续录入

- 「保存并继续添加」：保存后保留分类、单位等不随条目变化的字段，清空名称、品牌、价格等每条重填的字段，弹窗保持打开。
- 字段策略配在 `useRecordForm` 的 `clearOnContinue` / `keepOnContinue`，业务 hook 不维护标志位。

## 枚举口径

- 跨模块使用的枚举必须定义在 `lib/shared/`，不得定义在业务目录。
- 一个枚举字典必须同时提供五件套：枚举值数组 + 选项元数据 + 取值解析 + 合法性判断 + 渲染组件。
- 服务端 zod enum 与前端选项从同一份导入，不得各写一份字面量。
- 渲染组件放 `app/components/ui/`（份量用 `PortionTag`）。
- 跨业务域引用必须走 `app/components/ui/` 或 `lib/shared/`，禁止 `app/components/<域A>/` 直接 import `app/components/<域B>/`。

## 操作列

- 删除统一收敛到详情页；列表操作列不放删除（酱料例外：删除放在编辑弹窗底部）。
- 顺序（食材库专有）：原料 = 转净料 / 复制 / 编辑；净料与小料 = 打印标签 / 复制 / 编辑；调料 = 复制 / 编辑。

## 文案与字号

- 正文与辅助信息不小于 12px，用 `text-xs`；禁止 `text-[9px]` / `[10px]` / `[11px]`。
- 数字用等宽字体类；金额、单价、份数保持同一展示口径。

## 状态与反馈

- 状态用 `StatusBadge` / `statusToVariant`，不手写颜色映射。
- 空态 `EmptyState`、加载 `LoadingState` / `SkeletonTable`、提示 `sonner` toast。

## 验收

1. `npm run lint` —— 不应新增 `no-restricted-syntax` 告警。
2. `/ui-kit` 三档宽度目视检查。
3. 改动页面的桌面宽度实机走一遍主路径。
