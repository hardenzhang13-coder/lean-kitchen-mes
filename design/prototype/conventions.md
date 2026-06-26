# 库存管理首页原型 · 项目约定

## 约定文档

- **颜色体系**：主色使用项目全局CSS变量 --primary（oklch(0.553 0.195 38.402)），卡片背景 --card（白色），页面背景 --background（白色），文字 --foreground（深色），次要文字 --muted-foreground（灰色）。成功绿/警告黄/危险红使用语义变量：--success / --warning / --destructive。
- **字体**：标题/正文 DM Sans，等宽 Geist Mono。通过 Google Fonts 引入。
- **圆角**：卡片 radius-lg（12px），按钮 radius-md（8px），badge radius-sm（4px）。
- **时间格式**：相对时间（如"2天前"），使用 date-fns 的 formatDistanceToNow 语义。
- **不允许目的地不明的链接**：任何按钮/链接必须有明确的 href 或 onclick 行为。
- **二次确认**：删除/状态变更操作需要确认弹窗（本版原型中不演示，但设计意图保留）。
- **统一中文术语**：卡片视图（非 toggle-view）、列表视图（非 list-view）、弹窗（非 modal）、标签（非 chip）、悬停（非 hover）。
- **设计原则**：产品 UI 主体与"原型设计说明区"必须用 2px dashed 分隔线明确隔开。
- **列表多选框**：记录类/查阅类列表默认不带前置多选框；只有确有批量操作时才加。
- **详情入口**：食材卡片点击后进入详情页（本版不做，hover 提示"即将上线"）。
- **内容展示口径**：库存量展示实际数值，不用"充足/不足"结论文字充当数值。
