# 实施计划

## 当前 Sprint：Agent Runtime 闭环

目标：在增加 Plugin、MCP 或新 Dashboard 工作前，先完成一条接近生产形态的远程控制闭环。

必须走这条链路：

```text
Telegram / API / Web
  -> Command Queue
  -> Agent Runtime
  -> Agent Adapter
  -> Workspace / Executor
```

Telegram 只是 Remote Console。它不能拥有业务逻辑，不能读取 adapter 内存，不能直接控制 Runtime。

当前 Sprint 范围：

1. 在工作站启动 NCC AI OS。
2. 启动一个 Codex Agent session。
3. 从持久化真源读取当前 Agent 状态、任务上下文、stream events、日志和 Runtime 元数据。
4. 通过 Command Queue 发送 `continue`、`pause`、`resume`、`stop`。
5. 证明 Codex 能收到命令，Runtime 状态能实时变化。
6. 证明真实 allowlisted Telegram chat 既能读取状态，也能创建命令。

当前证据：

- API -> Command Queue -> Codex Runtime smoke 已在 Windows 通过。
- Fake Telegram client 检查覆盖 allowlist、`/status`、`/logs`、`/continue`、`/pause`、`/resume`、`/stop` 和 outbound formatting。
- 真实 Telegram/device smoke 仍被阻塞，直到配置 `AIC_TELEGRAM_BOT_TOKEN` 和 `AIC_TELEGRAM_ALLOWED_CHAT_IDS`。

当前 Sprint 停止条件：

- 真实 Telegram `/status` 能返回 live session 的持久化 runtime/stream/log 上下文。
- 真实 Telegram `/continue`、`/pause`、`/resume`、`/stop` 创建 `source = telegram` 的命令。
- 这些命令在不绕过 Queue 的情况下改变 Codex-backed Runtime 状态。
- 任何代码或契约改动后，`pnpm -r --if-present lint`、`pnpm check`、`pnpm build`、guardrail check 和 `git diff --check` 必须通过。
- 证据记录到 `dev-docs/acceptance.md`。

在停止条件满足前，不开始 Plugin、MCP、多 Agent UI 或 Dashboard redesign 工作。

## MVP

目标：日常可用的本地 NCC AI OS 控制面。

构建顺序：

1. 项目真源和 monorepo scaffold。
2. 核心领域类型、DTO 和 session 状态机。
3. SQLite 迁移和 repository。
4. 带 config、auth、sessions、messages、logs、dashboard、socket server 的本地 server daemon。
5. 用于检查的内置 no-op agent，以及 Codex-compatible process adapter。
6. 带登录、总览、聊天、日志、文件、截图、设置的 Web app shell。
7. 文件变更和 Git 摘要服务。
8. 截图 artifact 服务。
9. PWA manifest 和 iPhone-first 响应式 polish。
10. Agent control commands 的 Command Queue baseline。
11. Agent Runtime heartbeat/status baseline。
12. 基于 Command Queue 的 Telegram Remote Console baseline。
13. 用于 status/progress/log events 的 durable Agent Stream replay。
14. 启动和开发文档。

MVP 明确推迟 plugin marketplace、OAuth、Docker、CI/CD、terminal write access 和 cloud hosting。

## Beta

目标：稳定的多项目日常运行。

增加：

- 多 workspace。
- Session history 和恢复。
- Agent 配置页。
- Web Push notification 实现。
- 更好的日志搜索和虚拟滚动。
- 截图自动化触发器。
- 更完整的 Git 详情。
- 只读 terminal view，或强约束 terminal input。
- Plugin manifest registry。
- 备份/导出。

## 正式版

目标：可扩展的本地 AI Development OS。

增加：

- 多 Agent 并行运行。
- Claude/Gemini/GPT adapters。
- Workflow orchestration。
- 文件浏览器。
- Git 管理。
- Docker 管理。
- Deploy 管理。
- 自动测试和 CI/CD hooks。
- PostgreSQL 选项。
- OAuth 和 RBAC。
- Audit logs。
- Plugin sandbox 和 marketplace。

## 已吸收的 Bootstrap 停止条件

原始 bootstrap 停止条件已经被吸收。项目现在已经具备 active truth docs、monorepo scaffold、core contracts、SQLite repositories、server API/socket paths、Web PWA shell、Command Queue、Agent Runtime baseline、Codex process adapter、Agent Stream replay 和 Telegram Remote Console baseline。

当前有效停止条件是上面的“当前 Sprint”。
