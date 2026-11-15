---
name: ui-baseline
description: 新增或修改页面、弹窗、表格、表单、列表筛选等任何前端 UI 时使用。强制遵守 docs/interaction-visual-baseline-v1.md：页面骨架、语义弹窗尺寸、表单分组、列表与分页、字号下限、状态展示，避免新增 lint 违规与视觉漂移。
---

# 交互视觉基线 v1

唯一基线：`docs/interaction-visual-baseline-v1.md`。所有更早的 UI 规范文档（ui-ux-standardization-*、component-layer-optimization-spec 等）一律作废，不得作为依据。

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
- **已登记例外**：食材库 5 个清单（原料 / 净料 / 小料 / 调料 / 酱料）展示 `totalLabel` 与 `showPageSize`。新增例外必须先改基线文档，再改代码。

## 文案与字号

- 正文与辅助信息不小于 12px，用 `text-xs`；禁止 `text-[9px]` / `[10px]` / `[11px]`。
- 数字用等宽字体类；金额、单价、份数保持同一展示口径。

## 状态与反馈

- 状态用 `StatusBadge` / `statusToVariant`，不手写颜色映射。
- 空态 `EmptyState`、加载 `LoadingState` / `SkeletonTable`、提示 `sonner` toast。

## 详情

- 半屏详情用 `RecordSheet`（50vw）+ `RecordActions`；抽屉内参照列表用精简翻页。

## 验收

1. `npm run lint` —— 不应新增 `no-restricted-syntax` 告警。
2. `/ui-kit` 三档宽度目视检查。
3. 改动页面的桌面宽度实机走一遍主路径。
