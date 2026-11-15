---
name: commit-hygiene
description: 准备 git add / git commit 时使用，尤其是工作区同时存在多个 Agent 或多项无关改动时。要求先审阅 status 与 diff、按语义拆分提交、精确路径暂存，避免把他人中间态、临时文件或密钥一起提交。
---

# 提交卫生

本仓库常有多个 Agent 并行改同一工作区。提交前多花 30 秒审阅，比事后 revert 便宜得多。

## 提交前必做

```bash
git status --short
git diff --stat
git log --oneline -5
```

回答三个问题：

1. 哪些文件是**本次**改的？哪些不属于我？
2. 这些改动是不是同一件事？需要拆几个提交？
3. 有没有临时文件、生成物、密钥混在里面？

## 暂存规则

- **精确路径 `git add`**，一次列一个语义组。
- **禁止** `git add -A` / `git add .`。
- 不属于本次的文件：保持原状。不要 `git checkout --`、`git stash`、`git restore` 他人改动。
- 暂存后用 `git diff --cached --stat` 复核一遍。

## 拆分原则

按语义拆分，且每个提交都应能独立通过 `tsc`：

| 组 | 内容 |
|---|---|
| schema | `prisma/schema.prisma` + 新迁移（必须同进同出） |
| api | 路由 + zod schema |
| ui | 页面/组件 |
| test | 测试 |
| docs | 文档 / memory-bank |

如果拆开会产生无法构建的中间态（例如 schema 加了字段但 API 没同步），合并成一个提交，并在正文说明。

## 提交信息

```
type(scope): 中文摘要（≤ 50 字）

为什么这样做、有什么取舍；不要复述 diff。
```

`type` 用 feat / fix / refactor / docs / chore / test。scope 用模块名（schedules、ingredients、inventory…）。

## 明确排除

- `.env*`、`.claude/settings.local.json`
- `.codex-patch*`、临时补丁脚本、一次性排查脚本
- `.next/`、构建产物、日志
- 与本任务无关的格式化改动

## 禁止

- `--no-verify` 跳过钩子
- `--amend` 已推送的提交
- 强推 `main`
- 在未确认的情况下 push 或创建 PR（需用户明确要求）

## 完成后

```bash
git show --stat HEAD
git status --short
```

确认提交内容与预期一致，工作区只剩他人的改动。
