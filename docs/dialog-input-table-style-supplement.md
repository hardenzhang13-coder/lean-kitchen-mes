请执行以下补充优化任务。假设全局标准化和组件层优化已验收通过。

---

## 任务 1：弹窗宽度规范统一

### 1.1 宽度标准（全局适用）

| 弹窗类型 | 宽度 | 使用场景 |
|----------|------|----------|
| 小确认 | `sm:max-w-[400px]` | 删除确认、简单提示 |
| 标准表单 | `sm:max-w-[560px]` | 用户/供应商/单位/分类等单列表单 |
| 宽表单 | `sm:max-w-[800px]` | 复杂表单（如菜品创建步骤式） |
| 大表单 | `sm:max-w-[1200px]` | 左右布局表单（如食材表单：左侧表单+右侧列表） |
| 选择器 | `sm:max-w-[480px]` | 搜索选择器、Tile 选择器 |
| 导入/预览 | `sm:max-w-[960px]` | 导入对话框、数据预览 |

### 1.2 具体修改

| 文件 | 当前宽度 | 目标宽度 | 说明 |
|------|----------|----------|------|
| `app/components/ingredient-form-dialog.tsx` | `sm:max-w-[1000px]` | `sm:max-w-[1200px]` | 大表单（用户明确要求） |
| `app/components/import-dialog.tsx` | `sm:max-w-[960px]` | `sm:max-w-[960px]` | 已符合标准，保持不变 |
| `app/components/dish-create-wizard.tsx` | `sm:max-w-[800px]` | `sm:max-w-[800px]` | 已符合标准，保持不变 |
| `app/components/dish-create-wizard.tsx`（内部） | `sm:max-w-[480px]` | `sm:max-w-[480px]` | 选择器弹窗，保持不变 |
| `app/settings/users/page.tsx` | `sm:max-w-[540px]` / `sm:max-w-[400px]` | `sm:max-w-[560px]` / `sm:max-w-[400px]` | 标准表单改为 560px，删除确认保持 400px |
| `app/settings/suppliers/page.tsx` | `sm:max-w-[540px]` / `sm:max-w-[400px]` | `sm:max-w-[560px]` / `sm:max-w-[400px]` | 同上 |
| `app/settings/units/page.tsx` | `sm:max-w-[540px]` / `sm:max-w-[400px]` | `sm:max-w-[560px]` / `sm:max-w-[400px]` | 同上 |
| `app/settings/categories/page.tsx` | `sm:max-w-[540px]` / `sm:max-w-[400px]` | `sm:max-w-[560px]` / `sm:max-w-[400px]` | 同上 |
| `app/settings/classes/page.tsx` | `sm:max-w-[540px]` / `sm:max-w-[400px]` | `sm:max-w-[560px]` / `sm:max-w-[400px]` | 同上 |
| `app/components/searchable-select.tsx` | `sm:max-w-[480px]` | `sm:max-w-[480px]` | 选择器，保持不变 |
| `app/components/tile-select.tsx` | `sm:max-w-[480px]` | `sm:max-w-[480px]` | 选择器，保持不变 |

**注意**：`540px` 改为 `560px` 是取整统一，视觉差异极小。如果 CC 认为批量修改风险大，可以保留 540px，但建议统一为 560px。

---

## 任务 2：数值型输入框去掉原生 Spinner（上下箭头）

### 问题
所有 `type="number"` 的 Input 组件在浏览器中显示原生上下加减按钮（spinner），不符合极简设计风格。

### 修改方案

在 `components/ui/input.tsx` 中，当 `type === "number"` 时添加隐藏 spinner 的样式：

```tsx
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-transparent bg-input/50 px-2.5 py-1 text-sm transition-[color,border-color] duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        type === "number" && "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      {...props}
    />
  )
}
```

**备选方案**（如果 Tailwind v4 对 `appearance-none` 支持不同）：
在 `globals.css` 的 `@layer base` 中添加：
```css
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

**推荐**：优先在 Input 组件中通过 Tailwind className 处理，保持组件级封装。如果无效，则使用全局 CSS 备选方案。

**涉及文件**：
- `components/ui/input.tsx`（首选）
- `app/globals.css`（备选）

**全局搜索确认**：`type="number"` 在以下文件中使用：
- `app/schedules/new/page.tsx`
- `app/schedules/[id]/edit/page.tsx`
- `app/purchases/new/page.tsx`（多处）
- `app/ingredients/minor/page.tsx`
- `app/ingredients/net/page.tsx`（多处）
- `app/dishes/[id]/page.tsx`
- `app/components/dish-create-wizard.tsx`
- `app/components/ingredient-form-fields.tsx`（最新参照单价）
- `app/components/schedule-purchase-table.tsx`（多处）
- `app/components/schedule-cutting-table.tsx`
- `app/ingredients/sauce/page.tsx`

**注意**：排除排程/库存/菜品模块（用户指定），但 Input 组件是全局修改，影响所有模块。Input 组件本身属于全局基础组件，修改后自然生效于所有模块。

---

## 任务 3：左右布局表单中右侧列表样式与整体表格对齐

### 问题
`ingredient-form-dialog.tsx` 中右侧列表（同分类已添加食材）的表格样式与系统标准表格样式不一致：
- 容器使用 `border rounded-md p-4`（无 Card 背景）
- 表头高度、单元格 padding 与主体表格可能不一致
- 无表头固定阴影（主体表格有 sticky header 阴影）

### 目标设计

**右侧列表容器样式**：
```tsx
// 从
<div className="lg:w-[520px] flex flex-col min-h-0 border rounded-md p-4">

// 改为
<div className="lg:w-[520px] flex flex-col min-h-0 rounded-lg border bg-card">
```

**表头样式**：与标准表格一致，使用 `TableHeader` 默认样式（`h-10`）+ `sticky top-0 bg-background z-10`（已有）

**单元格样式**：与标准表格对齐（中等行高）
- `TableCell` 使用 `py-3 px-2`（如果全局 TableCell 已改为中等行高）
- 或保持 `text-sm` + 适当 padding

**表头文案**：与标准表格表头一致（`text-sm font-medium text-muted-foreground`）

**数据为空状态**：使用 `EmptyState` 组件或统一文案（而非内联 `<p>暂无数据</p>`）

**加载状态**：使用 `LoadingState` 组件（`type="inline"` 或 `type="table"` rows={3}）

### 具体修改

在 `app/components/ingredient-form-dialog.tsx` 中右侧列表区域：

```tsx
// 容器样式修改
<div className="lg:w-[520px] flex flex-col min-h-0 rounded-lg border bg-card">
  <div className="px-4 py-3 border-b">
    <h4 className="text-sm font-semibold text-muted-foreground">
      该分类下已添加的食材
    </h4>
  </div>
  <div className="flex-1 overflow-auto">
    {loadingList ? (
      <LoadingState type="table" rows={5} cols={6} />
    ) : rightList.length === 0 ? (
      <EmptyState
        icon={PackageOpen}
        title="暂无数据"
        description="该分类下尚未添加食材"
      />
    ) : (
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="whitespace-nowrap">名称</TableHead>
            <TableHead className="whitespace-nowrap">商品名称</TableHead>
            <TableHead className="whitespace-nowrap">采购规格</TableHead>
            <TableHead className="whitespace-nowrap">采购单位</TableHead>
            <TableHead className="whitespace-nowrap">入库单位</TableHead>
            <TableHead className="whitespace-nowrap text-right">最新参照单价</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rightList.map((row: ListItem) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-sm whitespace-nowrap">
                {row.name}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                {row.alias || "—"}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                {row.purchaseSpec || "—"}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                {row.purchaseUnit || "—"}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                {row.stockUnit || "—"}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap text-right">
                {row.latestRefPrice != null
                  ? `¥${Number(row.latestRefPrice).toFixed(2)}`
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </div>
</div>
```

**关键修改点**：
1. 容器：`border rounded-md p-4` → `rounded-lg border bg-card`（增加 Card 背景，去掉 padding，让内部表格自然）
2. 标题区：从直接 `<h4>` 改为有 `px-4 py-3 border-b` 的标题栏（与 Card 表头一致）
3. 内容区：去掉内层 `rounded-md border`（避免双层边框）
4. 空状态：使用 `EmptyState` 组件（需确认是否已创建）
5. 加载状态：使用 `LoadingState` 组件（需确认是否已创建）
6. 金额列：增加 `text-right` 对齐（与主体表格金额列一致）

**注意**：如果 `EmptyState` 和 `LoadingState` 组件尚未创建（在批次 1 中），则先用内联实现：
- 空状态：`text-sm text-muted-foreground p-8 text-center` + 图标
- 加载状态：`flex items-center justify-center h-24` + `Loader2`（保持现有）

---

## 验证清单

- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] 任务 1：`ingredient-form-dialog.tsx` 弹窗宽度为 1200px，其余弹窗宽度符合标准
- [ ] 任务 2：所有 `type="number"` 输入框无原生 spinner（Chrome/Edge/Safari 检查）
- [ ] 任务 3：右侧列表容器有 `bg-card` 背景，标题区有边框分隔，表格样式与主体表格一致
- [ ] 任务 3：右侧列表金额列右对齐，空状态/加载状态样式统一
