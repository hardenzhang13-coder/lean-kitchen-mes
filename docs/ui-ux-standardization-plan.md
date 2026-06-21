# 精益厨房 V3 —— 前端视觉交互体系标准化计划

> 基于 `ui-ux-pro-max` 设计框架与现有 [`ui-audit-report.md`](./ui-audit-report.md) 的二次审计，制定可执行的标准化路线图。
> 日期：2026-06-20

---

## 1. 目标与范围

### 1.1 核心目标
在 2–4 周内把整个项目从“页面级一致”提升到“设计系统级一致”，确保视觉、交互、可访问性、响应式遵循同一套规范。

### 1.2 范围
- **全局**：颜色 token、圆角、字体、焦点环、暗色模式、动画
- **组件层**：shadcn/ui 基础组件修正 + 缺失业务组件补齐
- **页面层**：表单、表格、空状态、加载态、状态标签、导航
- **可访问性**：aria-label、焦点管理、键盘导航、减少动画

### 1.3 设计原则（ui-ux-pro-max 优先级映射）

| 优先级 | 维度 | 本项目落点 |
|--------|------|-----------|
| 1 | Accessibility | 焦点环可见、表单字段级错误、icon-only 按钮 aria-label |
| 2 | Touch & Interaction | 触控目标 ≥44px、加载反馈、禁用状态语义化 |
| 3 | Performance | 图片非 base64、虚拟滚动/分页、CLS 控制 |
| 4 | Style Selection | 无 emoji、SVG 图标、统一品牌色、一致阴影/圆角 |
| 5 | Layout & Responsive | 移动优先、间距体系、无横向溢出 |
| 6 | Typography & Color | 语义颜色 token、字体层级、无硬编码 hex |
| 7 | Animation | 150–300ms、transform/opacity、prefers-reduced-motion |
| 8 | Forms & Feedback | 字段级错误、空状态、Toast 可访问性 |
| 9 | Navigation Patterns | 面包屑、精确高亮、深层链接 |
| 10 | Charts & Data | 图例/工具提示、状态颜色语义化 |

---

## 2. 现状摘要（与审计报告互补）

### 2.1 已具备的良好基础
- 34 个页面统一使用 `flex flex-col gap-6 p-8` 布局模式
- `PageHeader`、`SkeletonTable`、`Pagination` 已组件化
- 全部使用 `lucide-react`，未发现 emoji 作为图标
- 主要提交按钮都有 `disabled={loading}` + `Loader2` 反馈
- 暗色模式 CSS 变量已定义，只是部分硬编码颜色未适配

### 2.2 本次 ui-ux-pro-max 视角新增的 P0/P1 问题
| 问题 | 严重度 | 位置 | 设计系统冲突 |
|------|--------|------|-------------|
| 焦点环被全局 CSS 覆盖 | P0 | `app/globals.css:137-141` | 破坏键盘导航，违背 Accessibility #1 |
| icon-only 按钮触控目标 28–32px | P0 | `components/ui/button.tsx:28-30` | 低于 44px 触控标准 |
| 对话框动画 100ms | P1 | `components/ui/dialog.tsx:34,56` | 低于 150ms 可感知阈值 |
| 无 `prefers-reduced-motion` | P1 | `app/globals.css` | 忽略系统减少动画设置 |
| 关闭按钮 sr-only 英文 | P1 | `components/ui/dialog.tsx:75` | 中文化/本地化缺陷 |
| 加载文本无 aria-live | P1 | 登录/提交按钮 | 屏幕阅读器感知不到状态变化 |

---

## 3. 设计系统标准（Design System Spec）

### 3.1 颜色系统
```css
/* globals.css 新增语义状态变量 */
:root {
  --success: oklch(0.55 0.15 145);
  --success-muted: oklch(0.95 0.03 145);
  --warning: oklch(0.65 0.15 85);
  --warning-muted: oklch(0.96 0.03 85);
  --danger: oklch(0.58 0.25 27);
  --danger-muted: oklch(0.95 0.05 27);
  --info: oklch(0.55 0.15 250);
  --info-muted: oklch(0.95 0.03 250);
  --neutral: oklch(0.55 0 0);
  --neutral-muted: oklch(0.95 0 0);
}
.dark {
  --success: oklch(0.65 0.12 145);
  --success-muted: oklch(0.22 0.03 145);
  --warning: oklch(0.70 0.12 85);
  --warning-muted: oklch(0.22 0.03 85);
  --danger: oklch(0.70 0.15 27);
  --danger-muted: oklch(0.22 0.03 27);
  --info: oklch(0.65 0.12 250);
  --info-muted: oklch(0.22 0.03 250);
  --neutral: oklch(0.70 0 0);
  --neutral-muted: oklch(0.22 0 0);
}
```

### 3.2 圆角体系
恢复 shadcn 默认梯度，避免所有 `radius-*` 相同：
```css
--radius-sm: 0.25rem;
--radius-md: 0.5rem;
--radius-lg: 0.75rem;
--radius-xl: 1rem;
--radius-2xl: 1.5rem;
--radius-3xl: 1.75rem;
--radius-4xl: 2rem;
```

### 3.3 字体层级
| 元素 | 字号 | 字重 | 字体 |
|------|------|------|------|
| 页面标题 | text-2xl (24px) | font-bold | font-heading |
| 区块标题 | text-base (16px) | font-semibold | font-heading |
| 卡片标题 | text-base (16px) | font-medium | font-heading |
| 正文 | text-sm (14px) | font-normal | font-sans |
| 标签/辅助 | text-xs (12px) | font-medium | font-sans |
| 最小辅助 | text-xs | font-normal | font-sans |

**禁用** `text-[10px]` / `text-[9px]`，改用标准 `text-xs`。

### 3.4 间距体系
- 页面内边距：`p-8`（32px）
- 区块间距：`gap-6`（24px）
- 表单字段间距：`gap-2`（8px）
- 表单分区间距：`space-y-4` / `space-y-6`
- 按钮内边距：按 shadcn 默认

### 3.5 触控与交互
- 所有 icon-only 按钮最小点击区域 **44×44px**
- 表单输入高度统一为 **h-10**（默认）或 **h-11**（大对话框）
- 微交互动画时长 **200ms**，复杂动画 ≤300ms
- 支持 `prefers-reduced-motion: reduce`

### 3.6 焦点环
- 全局禁用 `outline: none` 硬编码
- 使用 shadcn 默认：`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`

---

## 4. 组件化路线图

### 4.1 立即新建/强化的业务组件

| 组件名 | 职责 | 替换目标 |
|--------|------|---------|
| `StatusBadge` | 统一状态标签（成功/警告/危险/中立/信息） | 所有页面内联状态色块 |
| `EmptyState` | 空状态（图标 + 文案 + 可选操作按钮） | 3 种空状态内联样式 |
| `LoadingState` | 加载状态（页面/表格/卡片骨架屏） | 3 种加载内联样式 |
| `IconButton` | 满足 44px 触控目标的图标按钮 | `size="icon"` 高频操作 |
| `FormField` 升级 | 字段级错误 + aria-describedby | 当前仅 Label + 必填标记 |

### 4.2 shadcn/ui 组件修正
- `Button`：`icon` / `icon-sm` 放大到 44px；`disabled` 加 `cursor-not-allowed`
- `Dialog`：`duration-100` → `duration-200`；关闭按钮 sr-only 中文化
- `Input`：统一 `text-base md:text-sm`，移除全局 `#007AFF` focus 覆盖
- `Card`：修正圆角变量使用

---

## 5. 分阶段实施计划

### Phase 1：全局基础修复（第 1 轮，1–2 天）
目标：消除 P0 阻断性问题，建立 token 基础。

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 1.1 | 移除全局 focus 硬编码 | `app/globals.css` | 输入框焦点使用 `var(--ring)`，键盘可见 |
| 1.2 | 新增语义状态颜色变量 | `app/globals.css` | success/warning/danger/info/neutral 及暗色对应 |
| 1.3 | 修复 radius token 梯度 | `app/globals.css` | sm→4xl 有合理递增 |
| 1.4 | 添加 reduced-motion 媒体查询 | `app/globals.css` | 系统减少动画时所有动画失效 |
| 1.5 | Sidebar 品牌色统一 | `app/components/sidebar.tsx` | indigo → primary/sidebar-primary |
| 1.6 | 必填标记改 destructive | `app/components/form-field.tsx` 等 11 处 | 无 `text-red-500` |
| 1.7 | 图标按钮放大到 44px | `components/ui/button.tsx` | icon/icon-sm ≥44px |
| 1.8 | 对话框动画与中文化 | `components/ui/dialog.tsx` | duration-200，sr-only="关闭" |

### Phase 2：组件标准化（第 2 轮，2–3 天）
目标：用新组件替换重复内联代码。

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 2.1 | 创建 `StatusBadge` | `app/components/status-badge.tsx` | 覆盖已结算/待结算/已作废/草稿/已发布/进行中/已完成 |
| 2.2 | 创建 `EmptyState` | `app/components/empty-state.tsx` | 支持 icon、title、description、action |
| 2.3 | 创建 `LoadingState` | `app/components/loading-state.tsx` | 支持 table/card/page 三种骨架 |
| 2.4 | 替换所有硬编码状态标签 | 见审计报告附录 | 无 `bg-{color}-100 text-{color}-700` 用于状态 |
| 2.5 | 替换空状态内联 | `purchases/page.tsx`, `dishes/page.tsx`, `page.tsx` 等 | 统一使用 `EmptyState` |
| 2.6 | 替换加载态内联 | 各列表页 | 统一使用 `LoadingState` |

### Phase 3：表单与可访问性（第 3 轮，3–5 天）
目标：表单体验达到可用性基准。

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 3.1 | 升级 `FormField` 支持错误态 | `app/components/form-field.tsx` | 支持 error + id + aria-describedby |
| 3.2 | 登录页字段级错误 | `app/login/page.tsx` | 错误显示在字段下方 |
| 3.3 | icon-only 按钮 aria-label | `app/ingredients/raw/page.tsx`, `app/purchases/new/page.tsx` 等 | 所有 icon-only 按钮有 aria-label |
| 3.4 | 提交按钮 aria-live | 主要表单页 | 加载状态可被屏幕阅读器感知 |
| 3.5 | 日期选择器错误态 | `app/components/date-picker.tsx` | 支持 invalid 样式 |

### Phase 4：响应式与复杂页面重构（第 4 轮，1–2 周）
目标：复杂表单在移动端可用。

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 4.1 | 采购单录入页响应式重构 | `app/purchases/new/page.tsx` | 移动端单列，无固定高度溢出 |
| 4.2 | 排程新建/编辑页响应式 | `app/schedules/new/page.tsx`, `app/schedules/[id]/edit/page.tsx` | 移动端可用 |
| 4.3 | 表格横向滚动提示 | 各表格页 | 可滚动时显示视觉提示 |
| 4.4 | 拆分大文件组件 | `dish-create-wizard.tsx`, `ingredient-form-dialog.tsx` | 单文件 <250 行 |

### Phase 5：导航与体验优化（第 5 轮，可选）
目标：深层导航可预测。

| # | 任务 | 文件 | 验收标准 |
|---|------|------|---------|
| 5.1 | 面包屑组件 | `app/components/breadcrumb.tsx` | 3 级及以上页面显示 |
| 5.2 | 侧边栏精确高亮 | `app/components/sidebar.tsx` | 避免过度匹配 |
| 5.3 | 暗色模式开关 | `app/components/theme-toggle.tsx` | 用户可手动切换 |

---

## 6. 自动化检测建议

为长期维持标准化，建议增加以下检测：

1. **ESLint 自定义规则**
   - 禁止 `text-red-500`、`bg-{color}-100 text-{color}-700` 等硬编码状态色
   - 强制 icon-only 按钮必须有 `aria-label`
   - 禁止 `outline: none` 裸写

2. **Tailwind CSS 类名扫描**
   - 扫描 `text-[10px]`、`text-[9px]` 等自定义字号
   - 扫描 `duration-100` 等过短动画

3. **可访问性检查**
   - 引入 `axe-core` 或 `eslint-plugin-jsx-a11y`
   - 对关键页面跑自动化 a11y 测试

---

## 7. 验收标准（整体）

- [ ] 全局无 `text-red-500`，全部使用 `text-destructive`
- [ ] 全局无 `bg-{color}-100 text-{color}-700` 状态标签，全部使用 `StatusBadge`
- [ ] Sidebar 使用主题 primary，无 indigo 硬编码
- [ ] 输入框焦点环使用 `var(--ring)`，键盘 Tab 可见
- [ ] 所有 icon-only 按钮触控区域 ≥44px 且有 aria-label
- [ ] 动画时长 ≥150ms，且支持 reduced-motion
- [ ] 主要列表页统一使用 `EmptyState` / `LoadingState`
- [ ] 登录页具备字段级错误提示
- [ ] 暗色模式下所有状态标签、侧边栏、图标颜色正常
- [ ] `purchases/new` 在 375px 宽度下无横向滚动和内容截断

---

## 8. 风险与依赖

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 颜色变量大改可能遗漏暗色模式适配 | 中 | 每改一处同时在 `.dark` 中验证 |
| 按钮尺寸放大可能破坏紧凑布局 | 中 | 先改全局 button，再逐页视觉回归 |
| 表单验证重构涉及业务逻辑 | 高 | Phase 3 仅做展示层错误，不动校验逻辑 |
| 采购单/排程响应式重构工作量大 | 高 | 拆分到 Phase 4，单独 PR |
