---
name: verify-change
description: 代码改动完成后的分层验证门禁。用户问「改好了吗 / 通过了吗」、准备 git commit、或改动涉及 schema/构建配置时使用。按快速/提交/发布三档执行 tsc、ESLint、定向 Jest、build 与 Prisma 零差异校验，并区分本次改动失败与并行会话造成的无关失败。
---

# 分层验证门禁

原则：本地验证结果必须能直接预测 CI。不要用 `npm run build` 代替 `tsc`，也不要在并行会话工作区里用全局结果给本次改动背书。

## 三档验证

### 1. 快速档 —— 每次修改后

```bash
npx tsc --noEmit
```

约 13 秒。0 错误继续；有错误先修，不要靠 `// @ts-ignore` 或 `as any` 绕过。

### 2. 提交档 —— git commit 前

```bash
npx tsc --noEmit
npm run lint
npx jest <本次改动相关的测试路径>
```

- 定向跑测试，不每次全量（全量约 100 秒）。
- 最终提交前至少跑一次全量 `npm test`。
- 要求 0 error；warning 不阻断，但要确认没有新增。

### 3. 发布档 —— 涉及以下任一情况时追加

- 修改 `prisma/schema.prisma` 或新增迁移
- 修改 `next.config.ts`、`package.json`、构建/Docker 配置
- 新增依赖
- 准备部署生产

```bash
npm run build
npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script
```

`migrate diff` 的 stdout 必须为空（退出码 0 且无 SQL）。有内容说明迁移历史与 schema 脱节，先补齐迁移，不要提交。

## 并行会话判定规则

本仓库经常有多个 Agent 同时改同一工作区。全局检查失败时：

1. 看报错文件是否属于本次改动范围。
2. 属于 → 必须修；不属于 → 汇报时明确写「X 文件的失败属于并行会话中间态，与本次无关」，并给出文件与错误摘要。
3. **禁止**在存在无关失败时声称「全绿」，也**禁止**为了变绿去修改他人文件。
4. **管道会掩盖退出码**：`npm test | tail` 的退出码来自 `tail`，即使 2 个失败也可能是 0。判断通过与否只看摘要行 `Tests: X passed, Y failed`，不要看 `$?`。
5. 同一命令前后两次结果不同（先失败、后全过）时，先确认工作区是否仍在被他人修改，再决定「修代码」还是「等对方落盘」。提交前必须复跑一次。

## 环境注意事项

- dev server 运行时执行过 `prisma generate` / `migrate` 后必须重启，否则 Prisma Client 类型与运行时不一致。
- 构建前停掉 dev server 并清理 `.next/dev`，否则 typedRoutes 生成文件可能被并发写坏。
- 长命令（build、全量测试）超过 1 分钟时，先说明预计耗时；不要用 `| tail` 让过程完全静默。

## 汇报格式

用三行交付结论，不要只贴原始日志：

```
tsc 0 错误 · lint 0 error / N warning · jest X/Y 通过
未覆盖：生产环境行为、build（本次未涉及构建配置）
```

## 参考

- `AGENTS.md` §2 代码检查流程
- `docs/interaction-visual-baseline-v1-rollout-plan.md` §4 回归清单
- 数据库相关验证同时遵守 `prisma-migration-guard` Skill
