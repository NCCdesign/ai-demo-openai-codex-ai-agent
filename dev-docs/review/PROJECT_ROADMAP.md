# Project Roadmap

## 总体路线

NCC AI OS 不应按“页面清单”推进，而应按平台能力推进。

推荐主线：

```text
工程治理
  -> 稳定运行
  -> 生产部署
  -> 多 Agent
  -> Plugin
  -> AI Workflow
  -> Knowledge Base
  -> Production Release
```

## Sprint 1：工程治理

目标：把项目从 MVP 命名和结构升级为 NCC AI OS 的可信基线。

任务：

- 将 active truth 命名升级为 NCC AI Development OS。
- 修复中文乱码和文案源。
- 建立 Command Queue 设计和核心状态机。
- 统一 API error model。
- 增加 production env validation。
- 更新 `dev-docs` 真源。

验收：

- `dev-docs/README.md` 明确 NCC AI OS。
- 默认密码/secret 在 production 启动失败。
- Command types/status/DTO/state machine 有 check。
- 乱码扫描通过。

优先级：P0。

## Sprint 2：稳定运行

目标：让系统能长期本地值守。

任务：

- 实现 commands/command_events 表。
- 实现 in-process command worker。
- Chat send、Stop、Screenshot、Git refresh 走 Command Queue。
- Agent runtime heartbeat。
- Workspace lease。
- Structured logs + redaction。
- Health live/ready/dependencies。

验收：

- 断线刷新后 command 状态可恢复。
- Agent/worker stale 可被发现。
- 同一 workspace 写操作不会无约束并发。
- 高风险日志不泄露 token/secret。

优先级：P0/P1。

## Sprint 3：生产部署

目标：电脑重启、服务崩溃、外出访问都可控。

任务：

- Windows PM2/NSSM/Task Scheduler 文档。
- Linux systemd 文档。
- Dockerfile + Docker Compose。
- Cloudflare Tunnel + Access 文档。
- backup/restore scripts。
- update/rollback scripts。
- Dashboard 显示 Backend/DB/Tunnel/Disk health。

验收：

- Windows 或 Linux 至少一条部署路径跑通。
- 备份可恢复 SQLite/artifacts。
- 远程访问不裸露 API 端口。

优先级：P1。

## Sprint 4：多 Agent

目标：Codex 只是一个 Agent Provider。

任务：

- Agent manifest/capability。
- Agent runtime instances。
- Claude/GPT/Gemini API provider。
- Codex process provider hardening。
- Agent settings UI。
- Per-agent concurrency/rate policy。

验收：

- 同一 workspace 可配置多个 Agent，但写入受 lease 控制。
- UI 按 capability 显示可用操作。
- Agent 重启/失败状态可追踪。

优先级：P1。

## Sprint 5：Plugin

目标：第三方能力通过插件边界接入。

任务：

- Plugin manifest schema。
- Plugin registry。
- Plugin permission policy。
- Secret store。
- Built-in GitHub plugin。
- Built-in Telegram 或 Discord notification plugin。
- Plugin health。

验收：

- 插件不能绕过 Command Queue。
- GitHub/Telegram 至少一个真实插件跑通。
- 插件 secret 不进入日志。

优先级：P1。

## Sprint 6：AI Workflow

目标：把常用开发流程自动化。

任务：

- Workflow schema。
- Workflow run/step command。
- Test workflow。
- Deploy workflow。
- PR review workflow。
- Human approval step。
- Retry/cancel/timeout。

验收：

- 能从手机触发“跑测试 -> 截图 -> 总结 -> 等确认 -> push/PR”。
- 每一步都有 command event 和日志。

优先级：P1/P2。

## Sprint 7：Knowledge Base

目标：让项目知识可长期沉淀。

任务：

- Workspace knowledge docs。
- Conversation summary。
- Artifact indexing。
- Search。
- Explicit memory save。
- Untrusted content labels。
- Prompt context builder。

验收：

- Agent 可引用项目长期知识。
- 用户可查看、删除、更新记忆。
- 外部内容不会隐式成为高信任指令。

优先级：P2。

## Sprint 8：Production Release

目标：成为日常主力 AI Development OS。

任务：

- RBAC/OAuth。
- Audit log UI。
- Full deployment docs。
- E2E tests。
- Load/retention tests。
- Plugin sandbox hardening。
- Release checklist。
- Public README 重写。

验收：

- build/check/test/deploy/docs 全部通过。
- 可以安全地通过受保护域名远程访问。
- 多 Agent、多项目、命令、日志、通知、插件形成闭环。

优先级：P1/P2。

## 总优先级

| 优先级 | 必须先做 |
| --- | --- |
| P0 | 产品命名真源、Command Queue、production env validation、command policy |
| P1 | Agent runtime durability、health/logging/deployment/plugin manifest |
| P2 | Knowledge base、workflow marketplace、完整插件市场、包名大迁移 |

## 标准评审矩阵

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 路线如果按页面推进 | Terminal、Docker、Deploy 页面会绕过统一控制面 | 当前 MVP 已有多个按钮直接调用 service | 按平台能力推进：Command Queue、Runtime、Security、Observability 先行 | M-L | 全项目 | P0 |
| Sprint 1 若不先治理命名和命令模型 | 后续 Agent/Plugin 都会继承旧边界 | 旧文档仍有 AI Agent Console 历史命名 | Sprint 1 固定 NCC AI OS 真源并建立 Command Queue 契约 | M | dev-docs, core, db, server | P0 |
| Sprint 2 若缺少 runtime durability | 长期无人值守不可靠 | Agent handle 仍在内存 Map | 增加 runtime instance、heartbeat、workspace lease | L | agents, runtime, server, db | P0 |
| Sprint 3 若缺少部署和备份 | 电脑重启、崩溃或数据损坏后无法恢复 | 当前只有 local development 文档 | Windows/Linux/Docker/Tunnel/Backup 形成可验证路径 | M | docs, scripts, deployment | P1 |
| 插件过早市场化 | 权限、secret、command 边界不稳时扩大风险 | Plugin SPI 和 policy 尚未实现 | 先做内置插件证明边界，再考虑外部插件市场 | L | plugins, security, server | P1 |
| Knowledge Base 过早自动化 | 未信任内容可能污染 Agent 指令上下文 | prompt/tool injection 策略未建 | 先做显式记忆和来源标记，再做自动检索注入 | L | db, agents, web | P2 |
