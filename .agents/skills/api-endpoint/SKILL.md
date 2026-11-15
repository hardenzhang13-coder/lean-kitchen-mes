---
name: api-endpoint
description: 新增或修改 app/api 下的路由、调整请求/响应契约、增加筛选或分页时使用。按仓库既有约定产出 zod schema、统一响应、操作日志、分页、权限登记与事务处理，避免出现默认仅管理员可见或漏日志的接口。
---

# 新增 / 修改 API 端点

本仓库是 REST（无 tRPC），所有接口遵循同一套骨架。照抄样板比自创结构更安全。

## 步骤

### 1. zod schema

放在 `lib/server/schemas/{domain}.ts`，不要写在 route 文件里。

- 创建与更新分开导出；更新用 `.partial()`，需要「显式 null = 清空」时用 `.nullish()`。
- 枚举优先复用 `lib/shared/` 下的常量（如 `PORTION_VALUES`），避免前后端各写一份。
- 查询 schema 用 `z.coerce.number()` 处理 page/pageSize，默认 `page=1, pageSize=20`，上限 100。

### 2. 路由骨架

```
validateQuery / validateBody → 组装 Prisma.XxxWhereInput → 查询 → 统一响应
```

- 文件必须叫 `route.ts`；动态段用 `[id]/route.ts`。
- `where` 明确标注 `Prisma.XxxWhereInput`，多条件用 `where.AND`，禁止 `any`。
- 软删除表默认加 `deletedAt: null`。
- 列表接口必须分页，返回 `paginated(rows, { page, pageSize, totalItems, totalPages })`。

### 3. 统一响应

只用 `lib/server/api-response.ts`：`success` / `created` / `paginated` / `badRequest` / `notFound` / `conflict` / `forbidden` / `internalError`。

`catch` 里先 `logger.error({ err }, "...")`，再返回 `internalError("中文可读文案")`。不要把 Prisma 原始错误抛给前端。

### 4. 操作日志

所有写操作（POST/PUT/PATCH/DELETE）调用：

```ts
await logOperation(req, { action: "create", entity: "net_ingredient", entityId: id, description: "..." });
```

没有 `logOperation` 的写接口视为未完成。

### 5. 权限登记

权限表在 `lib/shared/access-control.ts`。**未登记的 API 默认仅管理员可访问** —— 新接口必须显式加进对应分支，并同时检查 `proxy.ts` 与 `lib/shared/features.ts`（试运行锁定）。

### 6. 事务与并发

- 任何库存变动、多表关联写入必须包在 `prisma.$transaction` 内。
- 涉及扣减/作废的并发场景用条件更新（`where: { currentPortions: { gte: n } }`）或 Serializable + 唯一冲突重试，不要「先查后写」。
- 作废 ≠ 删除：通过反向流水回滚，不删原记录。

## 提交前检查清单

- [ ] 输入校验（zod 或严格手动校验）
- [ ] 写操作有 `logOperation`
- [ ] 列表有分页
- [ ] 权限已登记；试运行开关已考虑
- [ ] 无新增 `any`；`app/api/**` 与 `lib/**` 中 `no-explicit-any` 是 error
- [ ] MySQL 8.4 兼容（无数组列、无 `mode: "insensitive"`）
- [ ] 错误响应是中文可读文案

## 样板

- 简单 CRUD + 分页 + 唯一冲突：`app/api/net-packagings/route.ts`
- 事务内拆解与状态流转：`app/api/schedules/route.ts`
- 详情聚合与打印共用：`lib/server/schedule-detail.ts`
