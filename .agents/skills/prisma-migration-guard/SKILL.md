---
name: prisma-migration-guard
description: 修改 prisma/schema.prisma、新增数据库迁移、或部署涉及 schema 变更时使用。覆盖迁移 SQL 审计、零差异校验、schema 与 zod/文档同步，以及生产部署前的迁移与 seed 三件套审计，防止改坏生产数据。
---

# 数据库变更守卫

本仓库的数据库是 MySQL 8.4，迁移历史与 schema 必须严格一致。生产 `migrate` 服务实际执行 `prisma migrate deploy && prisma db seed` —— **部署 = 迁移 + 跑种子**，两者都要审计。

## 变更流程

1. **改 schema**：`prisma/schema.prisma`。字段用英文 + `@map("snake_case")`；考虑软删除 `deletedAt`；新表/新列评估索引与唯一约束。
2. **生成迁移**：
   - 交互环境：`npx prisma migrate dev`
   - 非交互 shell（本仓库常见）：`npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script > tmp.sql`，手建 `prisma/migrations/<timestamp>_<name>/migration.sql`，再 `npx prisma migrate deploy`。
3. **逐行审计 `migration.sql`**：
   - 是否有 `UPDATE` / `DELETE` 碰业务表？有则必须写明：目的、WHERE 范围、影响行数量级、回滚 SQL。
   - `ADD COLUMN ... NOT NULL DEFAULT` 会批量回填存量行，确认默认值符合业务语义。
   - `DROP`/`ALTER` 丢列前确认无代码引用。
4. **零差异校验**：`npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` 必须输出为空。
5. **同步下游**：
   - `lib/server/schemas/{domain}.ts`（zod）
   - 相关 API 的 select / 写入字段
   - `prisma/CLAUDE.md` 与 `memory-bank/Database.md`
6. **验证**：`npx tsc --noEmit` → 受影响测试 → 涉构建配置时 `npm run build`。

## 生产部署前三件套（缺一不可）

1. 逐行读本次涉及的**所有**迁移文件，确认对业务表无意外写入。
2. 逐行读 `prisma/seed.ts` 的**所有写操作**，列出它碰的表与覆盖语义；seed 必须「仅缺失时创建、不覆盖运营修改」。
3. 生产库**只读盘点**：相关表行数、受影响字段的取值分布、备份是否可用。结论以库为准，不以文档为准。

## 危险信号

- 全表 `UPDATE` 无 WHERE
- 迁移里删除数据、重建表、改字符集
- seed 使用 `upsert` 覆盖已有业务字段
- 迁移文件名时间戳早于已有迁移 / 已部署迁移被事后修改（会导致 checksum 不一致）
- schema 改了但迁移没生成，或本地库结构领先于迁移历史

## 回滚口径

迁移一旦应用生产，**不做反向迁移**（除非用户明确要求）。回滚优先走：备份恢复 → 数据修正脚本（只读盘点后 `--apply`）。任何 `--apply` 脚本必须先在本地库演练。

## 参考

- `prisma/CLAUDE.md`
- `docs/协作错误清单.md` E5（部署前漏审计 seed）、E6（继承过时结论）
- `memory-bank/Database.md`
