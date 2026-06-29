# Agent Architecture Review

## 1. 当前 Agent 如何运行

当前 Agent 流程：

```text
POST /api/sessions
  -> SessionService.createSession
  -> repo.createSession(status = starting)
  -> AgentRegistry.get(agent.type)
  -> AgentAdapter.start({ sessionId, workspacePath, onEvent, onStatus })
  -> adapter emits logs/status
  -> repo persists logs/status
  -> Socket.IO broadcasts log lines
```

当前内置适配器：

- `NoopAgentAdapter`：用于 smoke test，状态保存在内存 Map。
- `CodexProcessAgentAdapter`：通过 `runtime.startProcess` 启动本地 `codex` CLI，stdout/stderr 进入日志。

`AgentAdapter` SPI 是正确方向，但现在只是“进程适配器接口”，还不是“平台级 Agent Runtime”。

## 2. 多 Agent / 多项目 / 多 Workspace / 多 Session 支持

| 能力 | 当前状态 | 结论 |
| --- | --- | --- |
| 多 Agent 类型 | 类型预留 `codex/noop/claude/gemini/gpt`，实际实现 Codex/Noop | 有雏形，不完整 |
| 多 Agent 并发 | 每个 adapter 内存 Map 可放多个 session，但没有调度、限流、锁 | 不可靠 |
| 多项目 | `workspaces` 表存在，API 只读，UI 创建 session 固定 `wks_default` | MVP 单项目 |
| 多 Workspace | schema 支持，管理能力未实现 | 未完成 |
| 多 Session | DB 支持 session list/detail，UI 可切换 | 基础可用 |
| Session 恢复 | REST 可恢复历史消息和日志，不能恢复运行中子进程 | 部分可用 |
| Agent 状态恢复 | 进程 handle 在内存，重启丢失 | 不可用 |

## 3. 共享状态、竞争和阻塞问题

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| Adapter session handle 只在内存 Map | Server 重启、崩溃、升级后运行态丢失 | `CodexProcessAgentAdapter.sessions` 不持久 | 新增 `agent_runtime_instances` 表，记录 pid、status、heartbeat、recover policy | L | core, db, agents, server | P0 |
| 同一 workspace 可并发启动多个写入 Agent | 文件冲突、Git 工作区互相覆盖 | 缺少 workspace-level lease/lock | 引入 workspace lease：`exclusive_write`、`read_only`、`shared`；Command Queue 执行前检查 | M | db, server, runtime | P0 |
| `sendMessage` 直接写 stdin | 无背压、无幂等、无顺序保障 | Chat 消息绕过命令队列 | 用户消息应生成 `agent.message.send` command，由 worker 顺序投递 | M | server, agents, db, web | P0 |
| `stop` 直接调用 adapter | 停止动作不可审计、不可重试 | Endpoint 直接调用 `SessionService.stopSession` | `agent.session.stop` 也入队，支持 requested_at/ack_at/timeout/escalate kill | M | server, agents, runtime | P0 |
| 状态转换未统一使用状态机 | 非法状态可能写入 DB | repo 可直接 update status | `SessionService` 必须调用 core state machine；repository 只执行已验证写入 | S-M | server, db, core | P1 |
| stdout/stderr 无大小和速度控制 | 大量日志拖垮 SQLite、Socket、浏览器 | process runner 按行直接写库和广播 | 增加 log batch、rate limit、backpressure、drop policy with marker | M | runtime, server, db, web | P1 |
| Adapter 不声明能力 | UI 不知道某 Agent 是否支持截图、stop、streaming、file upload | Agent type 只是字符串 | Agent manifest 增加 `capabilities`、`commands`、`input_modes` | M | core, agents, web | P1 |

## 4. 推荐 Agent Runtime 架构

```text
Agent Definition
  id, type, name, provider, config, capabilities

Agent Runtime Instance
  id, agent_id, workspace_id, session_id, pid, status, heartbeat_at, started_at, stopped_at

Agent Session
  durable conversation + commands + events + logs

Command Queue
  user/control/system commands
  -> scheduler
  -> workspace lease
  -> adapter handler
  -> events/logs/status
```

推荐新增核心概念：

- Agent Provider：Codex、Claude、Gemini、GPT、本地模型、MCP。
- Agent Definition：用户可配置的具体 Agent。
- Agent Runtime Instance：一次实际运行。
- Agent Session：一次对话/任务上下文。
- Agent Capability：该 Agent 支持哪些输入、输出、工具和控制动作。
- Workspace Lease：防止同一项目被多个写入 Agent 同时改。

## 5. 适配 Claude / Gemini / GPT / Codex / 本地模型 / MCP

不要为每个模型做一套 UI 或 route。统一为：

```ts
interface AgentProvider {
  type: string;
  manifest: AgentManifest;
  createRuntime(config): AgentRuntime;
}

interface AgentRuntime {
  start(input): Promise<RuntimeHandle>;
  enqueue(command): Promise<void>;
  stop(input): Promise<void>;
  getStatus(instanceId): Promise<AgentRuntimeStatus>;
}
```

Provider 类型：

- Process Provider：Codex CLI、本地模型 CLI。
- API Provider：OpenAI GPT、Claude、Gemini。
- MCP Provider：启动或连接 MCP server，并把 MCP tools 注册为 Agent tools。
- Hybrid Provider：CLI + API + local tools。

## 6. Agent Conversation 要求

Agent Conversation 不等于 Chat Message。推荐结构：

```text
conversations
conversation_messages
message_parts
tool_calls
tool_results
commands
events
attachments
memory_refs
```

用户输入、Agent 回复、工具调用、命令执行、截图、日志摘要、Git diff、部署结果都应该能进入同一条可追溯 timeline。

## 7. 推荐数据库扩展

```sql
agent_providers (
  id text primary key,
  type text not null,
  version text,
  manifest_json text not null,
  enabled integer not null
);

agent_runtime_instances (
  id text primary key,
  agent_id text not null,
  session_id text not null,
  workspace_id text not null,
  pid integer,
  status text not null,
  heartbeat_at text,
  started_at text not null,
  stopped_at text,
  recover_policy text not null
);

workspace_leases (
  id text primary key,
  workspace_id text not null,
  session_id text not null,
  mode text not null,
  acquired_at text not null,
  expires_at text
);
```

## 8. 路线建议

| 阶段 | 动作 | 优先级 |
| --- | --- | --- |
| Sprint 1 | Command Queue + command 状态机 | P0 |
| Sprint 2 | Runtime Instance + heartbeat + restart reconciliation | P0 |
| Sprint 3 | Workspace lease + per-agent concurrency policy | P0 |
| Sprint 4 | Agent capabilities + manifest | P1 |
| Sprint 5 | Claude/GPT/Gemini API provider | P1 |
| Sprint 6 | MCP provider + tool registry | P1 |
| Sprint 7 | Local model/process provider hardening | P2 |

