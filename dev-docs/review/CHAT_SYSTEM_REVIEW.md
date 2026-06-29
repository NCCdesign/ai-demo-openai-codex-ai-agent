# Chat System Review

## 1. 当前聊天系统

当前 Chat 页面支持：

- 登录后选择 Agent。
- 创建 Session。
- 发送 Markdown 消息。
- 保存 messages。
- 简单 Markdown 渲染、代码块高亮。
- 停止当前 Session。
- 恢复最近 Session。

当前后端流程：

```text
POST /api/sessions/:id/messages
  -> repo.createMessage(role = user)
  -> AgentAdapter.sendMessage(sessionId, content)
  -> repo.appendLog(agent received message)
```

结论：当前是一个可用的 MVP Chat，不是生产级 Agent Conversation。

## 2. 必须升级的方向

聊天系统不能只是 ChatGPT 风格消息列表。NCC AI OS 需要的是 Agent Conversation，即：

- 用户意图。
- Agent 回复。
- Tool Call。
- Command Queue。
- 文件上下文。
- 截图。
- 终端输出。
- Git diff。
- 部署结果。
- 人工确认。
- 记忆和知识库引用。
- 可恢复 streaming。

## 3. 问题清单

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 消息直接调用 Agent stdin/API | 没有顺序、重试、审计、取消 | Chat endpoint 绕过 Command Queue | 用户输入先生成 `agent.message.send` command，再由 worker 投递 | M | server, db, agents, web | P0 |
| messages 表只有 role/content | 无法表达 tool call、attachments、streaming chunk、image、file refs | MVP 简化模型 | 增加 message parts、tool calls、attachments、memory refs | L | core, db, server, web | P1 |
| 没有 Assistant/Agent 回复持久模型 | 用户看不到完整对话闭环，只能看日志 | Codex process stdout 进入 logs，不进入 conversation | 定义 stdout 到 message/event 的映射策略：日志是原始流，conversation 是语义输出 | M | agents, server, web | P1 |
| Markdown parser 自研且简化 | 长文、表格、链接、嵌套列表、代码高亮能力有限 | 为避免新增依赖做了 MVP 实现 | Beta 可引入成熟 Markdown renderer，并保留 sanitization | S-M | web | P2 |
| 没有 streaming message | 手机端无法看到 Agent 正在生成的语义输出 | Socket 只传 log:line | 增加 `message:chunk` / `conversation:event`，REST 可恢复 chunk | M | socket, db, web | P1 |
| 没有文件上传/Image 输入 | 未来图像、日志包、patch 附件无法进入会话 | schema 未建 attachment | Artifact + Attachment 统一：上传先入 artifact，再在 message_part 引用 | M | db, server, web | P1 |
| 没有 Command UI 状态 | “继续/停止/截图/测试/部署”与聊天脱节 | 控制动作是按钮直连 API | 每个命令作为 conversation event 展示 queued/running/done/failed | M | web, server, db | P0 |
| 没有 Memory 边界 | 长期项目知识无法沉淀 | 当前只保存 session messages | 增加 workspace knowledge refs，先做显式收藏/摘要，不自动隐式记忆 | L | db, server, web | P2 |

## 4. 推荐 Conversation 数据模型

```sql
conversations (
  id text primary key,
  session_id text not null,
  title text,
  created_at text not null,
  updated_at text not null
);

conversation_messages (
  id text primary key,
  conversation_id text not null,
  role text not null,
  status text not null,
  created_at text not null,
  completed_at text
);

message_parts (
  id text primary key,
  message_id text not null,
  type text not null,
  content_text text,
  artifact_id text,
  order_index integer not null
);

tool_calls (
  id text primary key,
  message_id text not null,
  tool_name text not null,
  arguments_json text not null,
  status text not null,
  result_json text,
  created_at text not null,
  completed_at text
);

conversation_events (
  id integer primary key autoincrement,
  conversation_id text not null,
  command_id text,
  type text not null,
  payload_json text not null,
  created_at text not null
);
```

MVP 的 `messages` 表可以先作为 `conversation_messages` 的兼容来源，但正式版应迁移到多 part 模型。

## 5. Command Queue 与 Chat 的关系

所有用户输入都应分为两层：

```text
User Message
  -> persisted conversation message
  -> command created: agent.message.send
  -> command queued
  -> worker delivers to Agent
  -> Agent events/logs/tool calls
  -> conversation updates
```

“继续”“停止”“截图”“帮我看报错”“跑测试”“部署”都应成为 command，而不是特殊按钮直连 Agent。

## 6. UI 建议

Chat 页面应升级为 Agent 工作台：

- 左侧或顶部：Session / Workspace / Agent selector。
- 主区：Conversation timeline。
- Command cards：显示排队、运行、完成、失败、可取消。
- Tool call blocks：可展开输入参数和结果。
- File refs：点击打开 Diff 或文件预览。
- Screenshot refs：直接显示图片。
- Log refs：跳转到对应日志时间段。
- Human approval：危险操作必须点击确认。

## 7. 验收标准

| 验收项 | 标准 |
| --- | --- |
| 消息持久化 | 刷新后 conversation 完整恢复 |
| Command 关联 | 每条用户命令能追溯到 command id 和执行结果 |
| Streaming 恢复 | 断线后从 REST/event cursor 补齐缺失 chunks |
| Markdown 安全 | 不执行 HTML/script，代码块正常显示 |
| 附件安全 | 上传大小、类型、路径、病毒扫描策略明确 |
| 人工确认 | 高风险命令不会自动执行 |

