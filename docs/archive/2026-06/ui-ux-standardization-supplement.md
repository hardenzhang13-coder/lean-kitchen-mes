# 精益厨房 V3 — UI/UX 全局优化补充指令

> 本文档为 `ui-ux-standardization-spec.md` 的补充版，修正/补充 3 项需求。全局标准化执行过程中以此为准。
>
> 当前系统版本：Next.js 16.2.7 / React 19.2.4 / Tailwind CSS v4 / shadcn/ui v4

---

## 补充指令 1：全局微交互动画系统（覆盖原极简 Focus 方案）

> 原指令：Focus 极简模式（仅 border-color 变色）。
> **修正为**：增加完整的全局微交互动画系统，所有交互元素有柔和过渡，提升质感。

### 1.1 全局动画基础变量

在 `globals.css` 的 `@theme inline` 中新增：

```css
--transition-fast: 0.15s;
--transition-normal: 0.2s;
--transition-slow: 0.3s;
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
```

### 1.2 交互元素动画规范

| 元素 | 状态 | 效果 | 时长 | 缓动 |
|------|------|------|------|------|
| **Button** | hover | `brightness-105`（或 `opacity-90` 在深色按钮） | 150ms | ease-out |
| **Button** | active | `scale-[0.98]` | 50ms | ease-out |
| **Button** | disabled | `opacity-50` + 无 hover 效果 | 150ms | ease-out |
| **Input / Select / Textarea** | focus | `ring-2 ring-primary/15` + `border-primary` | 150ms | ease-out |
| **Input / Select / Textarea** | hover | `border-foreground/20` | 150ms | ease-out |
| **Card** | hover | `shadow-sm` + `translate-y-[-1px]`（已有则保持） | 200ms | ease-out |
| **Table Row** | hover | `bg-muted/50` | 150ms | ease-out |
| **Sidebar NavItem** | active | 左侧 indicator 竖条 `w-1 h-6 rounded-full bg-primary absolute left-1` + `bg-primary/10` + `text-primary` | 150ms | ease-out |
| **Sidebar NavItem** | hover | `bg-muted` + `text-foreground` | 150ms | ease-out |
| **Badge / Tag** | hover（可点击时） | `brightness-105` | 150ms | ease-out |
| **Dialog / Popover** | 打开/关闭 | 保持 shadcn 现有 `animate-in` / `animate-out` | 已有 | 已有 |
| **Toast** | 出现/消失 | 保持 sonner 现有 | 已有 | 已有 |
| **Link** | hover | `underline-offset-2` 增加 | 150ms | ease-out |

### 1.3 Focus 效果具体规范

**覆盖原极简 Focus 方案，改为柔和微交互：**

```css
/* globals.css — 修改 @layer base 中的 focus 规则 */
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--primary);
  ring-2 ring-primary/15; /* 柔和光晕，非 Apple 蓝 */
  transition: all 0.2s ease-out;
}
```

**注意**：
- 原极简方案（仅 border-color 变色）已废弃，改为 `ring-2 ring-primary/15`
- `ring` 不是 box-shadow，是 Tailwind 的 ring 系统，更柔和
- 颜色用 `var(--primary)`（暖橙色），不是 `#007AFF`
- 过渡时长 0.2s ease-out

### 1.4 关键修改点

1. `globals.css` — 新增 `--transition-*` / `--ease-*` 变量，修改 focus 规则（从极简改为 ring 模式）
2. `components/ui/button.tsx` — 确认已有 `active:translate-y-px`，补充 `active:scale-[0.98]`（如果 Base UI 不冲突）
3. `components/ui/table.tsx` — `TableRow` 增加 `transition-colors`（已确认已有，但需检查时长是否为 150ms）
4. `app/components/sidebar.tsx` — NavItem active 态增加左侧 indicator 竖条

**涉及文件**：`globals.css`、Button/Table/Sidebar 组件

---

## 补充指令 2：系统 LOGO 优化（方案 A：方章风格）

> 原指令：LOGO 方案 A。
> **确认执行**：方案 A（文字方章风格）。

### 2.1 当前状态

```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
  精
</div>
<span className="text-xs font-medium text-muted-foreground">精益厨房</span>
```

### 2.2 目标设计

```tsx
<div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground transition-all hover:brightness-105">
  <span className="font-heading font-bold text-sm">精</span>
</div>
<span className="text-[10px] font-medium text-muted-foreground tracking-tight">精益厨房</span>
```

**规范**：
- 容器：`h-10 w-10`（40px，比当前 32px 大一级）
- 圆角：`rounded-md`（6px，与全局降级后一致）
- 背景：`bg-primary`（暖橙色）
- 文字：`font-heading font-bold text-sm`（16px，粗体，用 heading 字体）
- 颜色：`text-primary-foreground`（自动适配 primary 对比色）
- hover：`brightness-105`（轻微提亮），过渡 150ms
- 下方文字：`text-[10px] font-medium text-muted-foreground tracking-tight`（保持紧凑，增加字距）

**涉及文件**：`app/components/sidebar.tsx` 第 35-40 行

---

## 补充指令 3：用户头像区域优化 + 文案修改

### 3.1 头像区域优化

> **注意**：头像尺寸**不变**，保持 `h-8 w-8`（32px）。

#### 当前状态

```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted group-hover:bg-muted/80 shrink-0">
  <User className="h-4 w-4 text-muted-foreground" />
</div>
<span className="text-xs font-medium text-foreground truncate max-w-full px-0.5 leading-tight">
  {user?.name || user?.username || "用户"}
</span>
{user?.role && (
  <span className="text-[10px] text-muted-foreground truncate max-w-full px-0.5 leading-tight">
    {user.role}
  </span>
)}
```

#### 目标设计

```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0 transition-all hover:ring-2 hover:ring-primary/20">
  {user?.name ? user.name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
</div>
<span className="text-xs font-medium text-foreground truncate max-w-full px-0.5 leading-tight">
  {user?.name || user?.username || "用户"}
</span>
{user?.role && (
  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-full font-medium">
    {user.role}
  </Badge>
)}
```

**规范**：
- 头像容器：`h-8 w-8 rounded-full`（保持现有尺寸）
- 无头像：显示用户名字**首字母**（大写），背景 `bg-primary/10`，文字 `text-primary font-bold text-sm`
- 有头像（未来扩展）：显示 `<img>`，object-cover
- hover：`ring-2 ring-primary/20`，过渡 150ms
- 用户名：`text-xs font-medium`（保持现有）
- 角色标识：**胶囊 Badge**（`variant="secondary"`，`rounded-full`，`text-[10px] h-4`）
- 整个用户区域 hover：`bg-muted`，过渡 150ms

#### 3.2 文案修改

| 原文案 | 新文案 | 位置 |
|--------|--------|------|
| 登出 | 退出 | Sidebar 按钮文字 |
| 已登出 | 已退出 | toast 提示文字 |
| 登出 | 退出 | `title` 属性 |

**涉及文件**：`app/components/sidebar.tsx` 第 67-97 行（用户区域 + 退出按钮）

---

## 更新后的验收标准（新增 3 项）

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 16 | 全局微交互动画 | 所有交互元素有 150ms 过渡动画，无跳变 | 浏览器交互验证 |
| 17 | Focus 效果 | 输入框 focus 有 `ring-2 ring-primary/15` + `border-primary` | 浏览器交互验证 |
| 18 | Sidebar 激活态 | 激活项有左侧 indicator 竖条 | 浏览器视觉检查 |
| 19 | 用户头像 | 显示首字母，hover 有 ring 效果，角色为胶囊 Badge | 浏览器视觉检查 |
| 20 | 退出文案 | 全局无"登出"字样，统一为"退出" | 代码 grep |
| 21 | 系统 LOGO | h-10 w-10，rounded-md，hover 有亮度变化 | 浏览器视觉检查 |

---

## 与主 Spec 的冲突处理

| 主 Spec 原指令 | 补充指令 | 执行优先级 |
|---------------|---------|-----------|
| Focus 极简：仅 `border-color` 变色 | Focus 有微交互：`ring-2 ring-primary/15` + 动画 | **以补充指令为准** |
| 无微交互动画定义 | 完整全局微交互动画系统 | **以补充指令为准** |
| 无 LOGO 优化 | 方案 A：方章风格 | **新增，按补充指令执行** |
| 无头像优化 | 头像尺寸不变 + 胶囊角色标签 | **新增，按补充指令执行** |
| 无文案修改 | "登出"→"退出" | **新增，按补充指令执行** |
| 其余（颜色/圆角/高度/表格/分页/图标） | 无冲突 | 按主 Spec 执行 |

---

## 涉及文件汇总（仅补充指令部分）

### 核心修改
- `app/globals.css` — 新增动画变量，修改 focus 规则（从极简改为 ring 模式）
- `app/components/sidebar.tsx` — LOGO 优化、用户头像胶囊标签、退出文案
- `components/ui/button.tsx` — 确认 active 动画
- `components/ui/table.tsx` — 确认 row hover 过渡

### 全局排查（确认无遗漏）
- `grep -r "登出" app/` — 确保全局无"登出"残留
- `grep -r "已登出" app/` — 确保全局无"已登出"残留
