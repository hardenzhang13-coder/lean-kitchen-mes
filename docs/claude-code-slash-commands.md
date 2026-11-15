# Claude Code 斜杠命令速查

> 适用版本：Claude Code 2.1.325（桌面 App Code 标签页 / 终端 CLI）
> 最后核对：2026-11-15
>
> 说明：命令清单会随版本变化。**最权威的列表是直接在输入框敲 `/`**，弹出的菜单就是当前环境真正可用的命令。

---

## 一、基本用法

1. 在消息输入框输入 `/`，弹出命令列表
2. 方向键上下选择，回车执行
3. 大部分命令支持跟一句自然语言，例如 `/code-review 帮我看看这次改动有没有 bug`

---

## 二、日常最常用的 10 个

| 命令 | 作用 | 什么场景用 |
|---|---|---|
| `/clear` | 开一个全新对话 | 换话题时，避免旧上下文干扰 |
| `/compact` | 把长对话压缩成摘要 | 聊太久、开始变慢或变笨时 |
| `/context` | 查看上下文占用了多少 | 想知道"还剩多少空间" |
| `/rewind` | 回退到之前的某一步 | 改错了代码、想撤销刚才那几步 |
| `/resume` | 恢复之前的会话 | 关掉后又想接着聊 |
| `/model` | 切换模型 | 复杂任务用强模型，杂活用便宜模型 |
| `/effort` | 调整推理强度（低/中/高） | 简单改动调低更快，难题调高更准 |
| `/plan` | 先出方案、确认后再动手 | 大改动前必用，防止乱改 |
| `/code-review` | 审查当前代码改动找 bug | 提交前 |
| `/usage` | 看用量和额度 | 想知道花了多少 |

---

## 三、按场景分类

### 1. 会话管理

| 命令 | 作用 |
|---|---|
| `/branch [名字]` | 把当前对话分叉成一条新支线（试两种方案时用） |
| `/fork` | 把对话复制一份放到后台跑 |
| `/background`（`/bg`） | 让任务转后台继续跑，接着聊别的 |
| `/btw` | 插入一个"顺便问一句"，不污染主线上下文（不存盘） |
| `/rename` | 给会话改名字 |
| `/export` | 导出完整对话记录 |
| `/recap` | 一句话总结当前进展 |
| `/tasks`（`/bashes`） | 看后台任务列表 |
| `/stop` | 停掉后台会话 |
| `/goal` | 设定跨多轮的目标并持续追踪 |
| `/exit`、`/quit` | 退出 |

### 2. 上下文与长期记忆

| 命令 | 作用 |
|---|---|
| `/init` | 扫描项目、自动生成 `CLAUDE.md` 项目说明书 |
| `/memory` | 管理 `CLAUDE.md` 与自动记忆 |
| `/add-dir <路径>` | 把另一个文件夹也纳入可访问范围 |
| `/cd <路径>` | 切换会话所在目录 |

### 3. 模型与输出

| 命令 | 作用 |
|---|---|
| `/fast [on/off]` | 快速模式（出字更快，按快速模式计费） |
| `/output-style` | 切换输出风格（详细讲解 / 简洁等） |
| `/theme` | 界面配色 |

### 4. 权限与安全

| 命令 | 作用 |
|---|---|
| `/permissions` | 权限规则；桌面版中仅弹出「权限模式选择器」 |
| `/sandbox` | 开关沙箱（命令在受限环境中执行） |
| `/fewer-permission-prompts` | 扫描历史，把常批准的操作加入白名单，减少弹窗 |
| `/security-review` | 安全检查（漏洞、注入风险等） |

桌面版切换权限模式：`Ctrl/Cmd+Shift+M` 或界面上的模式选择器（`Shift+Tab` 在桌面版不生效）。

### 5. 代码质量与验证

| 命令 | 作用 |
|---|---|
| `/simplify` | 只做简化重构，不找 bug（与 `/code-review` 互补） |
| `/verify` | 端到端验证改动是否真正生效 |
| `/diff` | 打开改动对比视图 |
| `/debug` | 打开调试日志排查问题 |
| `/run` | 启动并驱动本项目应用查看效果 |

### 6. 技能、插件与自定义

| 命令 | 作用 |
|---|---|
| `/skills` | 列出全部技能，可开关 |
| `/reload-skills` | 新增技能文件后热加载，无需重启 |
| `/plugin` | 插件管理器 |
| `/reload-plugins` | 重新加载插件 |
| `/mcp` | 管理 MCP 外部工具连接 |
| `/agents`、`/list-agents` | 子代理 / 其他会话 |
| `/hooks` | 查看钩子（自动化触发器） |
| `/update-config` | 修改 `settings.json` 中的自动化行为 |

### 7. 集成与协作

| 命令 | 作用 |
|---|---|
| `/ide` | 连接 VS Code / JetBrains |
| `/desktop`（`/app`） | 在桌面 App 中打开 |
| `/remote-control`（`/rc`） | 开启远程控制，用手机或 claude.ai 跟进 |
| `/install-github-app` | 安装 GitHub App（PR 自动修 CI 需要） |
| `/mobile` | 手机端二维码 |

### 8. 排错与反馈

| 命令 | 作用 |
|---|---|
| `/help` | 帮助菜单 |
| `/doctor` | 体检并检查配置问题 |
| `/status` | 当前状态 |
| `/bug` | 报 bug |
| `/feedback` | 提产品建议 |
| `/release-notes` | 更新日志 |
| `/insights` | 生成用量报告 |

---

## 四、本仓库专属技能命令

这些不是内置命令，来自 `.agents/skills/`（`.claude/skills/` 为发现用目录链接）：

| 命令 | 什么时候用 |
|---|---|
| `/api-endpoint` | 新增或修改 `app/api/**` 路由 |
| `/prisma-migration-guard` | 修改 `prisma/schema.prisma`、新增迁移 |
| `/domain-pricing` | 涉及净料价格、成本、出成率、单位换算、份数口径 |
| `/ui-baseline` | 新增或修改页面 / 弹窗 / 表格 / 表单 |
| `/verify-change` | 代码改完、提交前、问「是否通过」 |
| `/commit-hygiene` | `git add` / `git commit` 前 |
| `/ui-ux-pro-max` | UI/UX 设计提升 |

自定义技能也可用子目录命名空间（`.claude/commands/frontend/component.md` → `/frontend:component`）。

---

## 五、桌面版 Code 标签页与终端的差别

| 项 | 差别 |
|---|---|
| `/config`、`/hooks`、`/permissions` 的细化页 | 桌面版会要求到终端操作；请改用 App 自身设置界面，或在终端运行 `claude` |
| `/tui`、`/scroll-speed`、`/terminal-setup`、`/focus` | 终端/全屏特性，桌面版可能不可用 |
| `/btw` | 侧聊不存盘 |
| `/reload-plugins` | 仅对直接输入的命令生效 |
| 权限模式切换 | 用 `Ctrl/Cmd+Shift+M`，`Shift+Tab` 不适用 |
| 云端会话 | 不提供 bypass 权限，仅支持 Accept edits / Plan / Auto |

不确定某命令在当前环境是否可用时，敲 `/` 看列表——**列表就是权威答案**。

---

## 六、已移除或改名的命令

| 旧命令 | 现状 |
|---|---|
| `/review` | 改名 `/code-review`（旧名仍可用） |
| `/cost`、`/stats` | 合并进 `/usage` |
| `/settings` | 即 `/config` |
| `/allowed-tools` | 即 `/permissions` |
| `/vim` | 已移除（2.1.92） |
| `/pr-comments` | 已移除（2.1.91） |
| `/ultraplan` | 已移除，改用计划模式 |
| `/extra-usage` | 改名 `/usage-credits` |
