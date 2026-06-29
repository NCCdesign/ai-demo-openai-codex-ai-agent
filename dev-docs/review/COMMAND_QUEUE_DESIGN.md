# Command Queue Design

## 1. 设计结论

NCC AI OS 必须引入统一 Command Queue。所有控制动作都必须通过它：

- 继续。
- 暂停。
- 停止。
- 截图。
- 运行测试。
- 查看报错。
- 刷新 Git diff。
- 部署。
- 推送 GitHub。
- 发送 Telegram/微信远程指令。
- Agent tool call。
- Workflow step。

不要让按钮、Chat、Socket、插件直接调用 Agent 或 Runtime。

## 2. 当前问题

当前命令发送路径：

```text
Chat message -> POST /api/sessions/:id/messages -> AgentAdapter.sendMessage
Stop button  -> POST /api/sessions/:id/stop -> AgentAdapter.stop
Screenshot   -> POST /api/sessions/:id/screenshots -> screenshot runtime
File refresh -> POST /api/sessions/:id/file-changes/refresh -> Git runtime
```

这些路径在 MVP 中可接受，但作为 AI OS 会产生控制面分裂。

## 3. 风险清单

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 每个按钮直连不同 service | 无统一审计、权限、重试、取消 | HTTP route 直接执行业务动作 | 所有动作创建 command，由 worker 执行 | M | server, db, web | P0 |
| Chat 消息直接写 Agent stdin | 顺序和失败不可追踪 | 没有 command id | `agent.message.send` command 绑定 message id | M | chat, agents | P0 |
| Stop 不是可恢复命令 | 停止失败或超时无法升级 kill | route 直接调用 adapter.stop | `agent.session.stop` 支持 timeout、escalate、ack | M | agents, runtime | P0 |
| 截图/测试/部署同步执行 | 长任务阻塞 HTTP request，手机网络断开后状态丢失 | 缺少 async job | command worker 异步执行，UI 订阅状态 | M | server, web | P1 |
| 无幂等 key | 手机重复点击可能重复执行部署/测试 | 请求无去重 | command 增加 `idempotency_key` | S-M | db, server | P1 |
| 无权限模型 | 插件或远程入口可绕过安全策略 | route 分散鉴权 | command policy 统一判断 actor、target、capability | M | security, plugins | P0 |

## 4. Command 数据模型

推荐先在 SQLite 增加：

```sql
commands (
  id text primary key,
  type text not null,
  status text not null,
  priority integer not null,
  actor_user_id text,
  workspace_id text,
  session_id text,
  agent_id text,
  target_kind text,
  target_id text,
  payload_json text not null,
  result_json text,
  error_code text,
  error_message text,
  idempotency_key text,
  requested_at text not null,
  queued_at text not null,
  started_at text,
  completed_at text,
  cancelled_at text,
  deadline_at text
);

command_events (
  id integer primary key autoincrement,
  command_id text not null,
  type text not null,
  payload_json text not null,
  created_at text not null
);

command_locks (
  id text primary key,
  command_id text not null,
  resource_kind text not null,
  resource_id text not null,
  mode text not null,
  acquired_at text not null,
  expires_at text
);
```

状态：

```text
queued | running | waiting_for_user | completed | failed | cancelled | timed_out
```

## 5. Command 类型

建议初始类型：

```text
agent.message.send
agent.session.stop
agent.session.pause
agent.session.resume
agent.screenshot.capture
workspace.git.refresh_changes
workspace.git.diff
workspace.test.run
workspace.deploy.run
notification.send
plugin.invoke
workflow.run
workflow.step.run
```

不要用自由字符串在各处散落。类型常量和 payload DTO 由 `packages/core` 拥有。

## 6. 执行流程

```text
REST / Socket / Plugin / Remote Webhook
  -> authenticate actor
  -> validate command payload
  -> policy check
  -> insert command queued
  -> emit command:created
  -> worker picks command
  -> acquire workspace/session locks
  -> execute handler
  -> persist command events/logs/result
  -> emit command:status_changed
  -> release locks
```

## 7. Worker 设计

MVP 后第一版可以是 server 内进程 worker：

```text
apps/server/src/workers/command-worker.ts
```

SQLite 轮询间隔可短，但不是 UI 每秒轮询。worker 本地轮询 DB 是可以接受的临时方案。后续 PostgreSQL 可升级为 LISTEN/NOTIFY 或独立队列。

Worker 必须支持：

- 单次取 N 条 queued command。
- 状态 CAS 更新：`queued -> running`。
- deadline timeout。
- cancellation check。
- command handler registry。
- structured error。
- command events。

## 8. Handler Registry

```ts
interface CommandHandler<TPayload, TResult> {
  type: CommandType;
  requiredCapabilities: string[];
  validate(payload: unknown): TPayload;
  execute(ctx: CommandContext, payload: TPayload): Promise<TResult>;
}
```

内置 handler：

- AgentMessageSendHandler。
- AgentStopHandler。
- ScreenshotCaptureHandler。
- GitRefreshChangesHandler。
- NotificationSendHandler。

插件也只能注册 handler，不能绕过 command worker。

## 9. 权限与安全

Command policy 统一判断：

- actor 是否登录。
- actor role 是否允许。
- target workspace 是否允许。
- command type 是否高风险。
- 是否需要人工确认。
- payload 是否包含路径/命令/URL。
- plugin 是否声明 capability。

高风险命令：

- shell/terminal write。
- deploy。
- git push。
- docker destructive operations。
- file delete/move。
- external network webhook。

高风险命令进入：

```text
queued -> waiting_for_user -> running
```

## 10. API 设计

```text
GET  /api/commands?status=&workspaceId=&sessionId=
POST /api/commands
GET  /api/commands/:id
POST /api/commands/:id/cancel
POST /api/commands/:id/approve
GET  /api/commands/:id/events
```

Socket events：

```text
command:created
command:status_changed
command:event
command:requires_approval
```

## 11. 验收标准

| 验收项 | 标准 |
| --- | --- |
| 统一入口 | Chat send、Stop、Screenshot、Git refresh 都创建 command |
| 幂等 | 重复请求不会重复执行同一个高风险 command |
| 可恢复 | 刷新页面后能看到 command 当前状态和历史事件 |
| 可取消 | queued/running command 有明确取消语义 |
| 可审计 | 每个 command 有 actor、payload、result、events |
| 策略 | 高风险 command 必须经过 policy 和可选 approval |

## 12. 开发顺序

| 顺序 | 任务 | 优先级 |
| --- | --- | --- |
| 1 | `packages/core` 定义 command types/status/DTO/state machine | P0 |
| 2 | DB migration 增加 commands/command_events | P0 |
| 3 | Server command repository + command service | P0 |
| 4 | In-process command worker + handler registry | P0 |
| 5 | 改造 Chat send 和 Stop 走 command | P0 |
| 6 | 改造 Screenshot/Git refresh 走 command | P1 |
| 7 | Dashboard/Chat 显示 command cards | P1 |
| 8 | Approval/cancel/retry | P1 |

