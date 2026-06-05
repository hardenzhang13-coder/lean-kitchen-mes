# 精益厨房 V3 — 设计规范

> 页面布局及侧边栏为自定制项。其余所有 UI 组件（按钮/输入框/表格/卡片/Modal/Badge 等）遵循 **shadcn/ui 默认规范**。Web 端与移动端交互遵循 shadcn/ui 和 Tailwind CSS 标准。

---

## 一、页面布局

```
┌──────────┐  ┌─────────────────────────────────────────┐
│  🍳      │  │  Header: 标题 + 操作按钮                 │
│  精益厨房  │  │                                         │
│          │  │  ┌──────┐ ┌──────┐ ┌──────┐              │
│  ⊞ 工作台 │  │  │统计卡│ │统计卡│ │统计卡│              │
│  📋 排程  │  │  └──────┘ └──────┘ └──────┘              │
│  🛒 采购  │  │                                         │
│  📦 库存  │  │  ┌─────────────────────────────────┐    │
│  🍽️ 菜品  │  │  │ 列表/表格                        │    │
│  🥬 食材  │  │  └─────────────────────────────────┘    │
│  📖 字典  │  │                                         │
│          │  │                                         │
└──────────┘  └─────────────────────────────────────────┘
    fixed          flex-1 flex-col ml-20
   w-20 h-full     px-8 py-6
   左侧固定         max-w-[1440px] mx-auto
```

- 侧边栏 `fixed left-0 top-0 h-full w-20`，不参与文档流
- 内容区 `flex-1 flex-col ml-20`

---

## 二、侧边栏

唯一自定制组件。`w-20` 紧凑图标式，7 个导航项竖向平铺，无分组。

| 状态 | 样式 |
|------|------|
| 品牌区 | `flex flex-col items-center justify-center py-4 border-b` |
| 品牌图标 | `w-7 h-7 rounded-lg bg-primary text-primary-foreground` |
| 品牌文字 | `text-[10px] font-bold text-foreground` |
| nav-btn 默认 | `flex flex-col items-center justify-center w-16 h-16 rounded-lg gap-1 text-muted-foreground hover:bg-muted hover:text-foreground` |
| nav-btn 激活 | `bg-primary/10 text-primary` |
| 导航图标/标签 | 图标: text-lg / 标签: text-[10px] font-medium |
| 间距 | `gap-2` 上下间距 |

---

## 三、颜色与字体

使用 **shadcn/ui 默认 CSS 变量体系** + Tailwind CSS v4 主题扩展：

- 背景 `bg-background` / 前景 `text-foreground`
- 卡片 `bg-card text-card-foreground`
- 强调 `bg-primary text-primary-foreground`
- 辅助 `text-muted-foreground`
- 边框 `border-border`
- 成功 `text-emerald-600` / 警告 `text-amber-600` / 错误 `text-red-600`
- 字体：`Inter, system-ui, -apple-system, sans-serif`

---

## 四、图标

导航图标统一使用 **Lucide Icons**（shadcn/ui 默认集成）。业务页面中表格和列表可用 emoji 辅助识别。

---

*版本：v1.2 | 2026.06.04 | 大幅精简：移除所有 shadcn/ui 默认组件样式定义，只保留布局和侧边栏定制项*
