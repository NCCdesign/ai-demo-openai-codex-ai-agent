# Plugin Architecture

## 1. 设计结论

NCC AI OS 未来必须插件化，但第一阶段不要急着做插件市场。

正确顺序：

```text
Core capability model
  -> Command Queue
  -> Plugin manifest
  -> Plugin registry
  -> Permission policy
  -> Built-in plugins
  -> External/plugin marketplace later
```

Telegram、Discord、Slack、GitHub、Vercel、Docker、OpenRouter、MCP 都应作为插件接入系统能力，而不是直接写进 `apps/server/src/services`。

## 2. 插件边界

插件可以提供：

- Command handlers。
- Agent providers。
- Tool providers。
- Notification channels。
- Webhook receivers。
- Health checks。
- UI extension metadata。
- Workflow actions。

插件不能直接：

- 绕过 Command Queue 调用 Agent/Runtime。
- 绕过 auth/policy 访问文件系统。
- 直接读写数据库 schema。
- 直接向 Socket room 广播。
- 直接读取 secrets。

## 3. 当前问题

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 无插件 manifest | 第三方接入会散落在 services | 插件还未实现 | 定义 `plugin.json` schema 和 TypeScript manifest | M | core/plugins | P1 |
| 无 capability/permission | 插件能做什么无法审查 | 没有安全模型 | 每个插件声明 capabilities/scopes/commands/secrets | M | core, security | P1 |
| 无 plugin registry | 启用/禁用/配置插件困难 | 当前 AgentRegistry 静态 | DB plugin_instances + registry loader | M | db, server | P1 |
| 无 UI extension contract | 页面会为每个插件硬编码 | web 没 extension point | 插件只声明导航、cards、settings schema；UI 渲染受控组件 | L | web, plugins | P2 |
| 无 webhook 安全 | GitHub/Telegram 回调可能被伪造 | Webhook 未实现 | 每个插件必须提供 signature verification | M | server, plugins | P1 |
| MCP 未建模 | MCP server/tool 会和 Agent tools 混乱 | 缺少 tool registry | MCP plugin 注册 tool provider 和 tool permissions | L | agents, plugins | P1 |

## 4. Plugin Manifest

推荐：

```json
{
  "id": "github",
  "name": "GitHub",
  "version": "0.1.0",
  "kind": "integration",
  "entry": "./dist/index.js",
  "capabilities": [
    "commands",
    "webhooks",
    "health",
    "notifications"
  ],
  "permissions": [
    "network:github.com",
    "secret:github.token",
    "command:github.pr.create",
    "command:github.workflow.read"
  ],
  "commands": [
    {
      "type": "github.pr.create",
      "risk": "medium",
      "requiresApproval": true
    }
  ],
  "settingsSchema": {}
}
```

## 5. Plugin SPI

```ts
interface Plugin {
  manifest: PluginManifest;
  register(ctx: PluginContext): Promise<void>;
}

interface PluginContext {
  commands: CommandRegistry;
  agents: AgentProviderRegistry;
  tools: ToolRegistry;
  notifications: NotificationChannelRegistry;
  health: HealthRegistry;
  secrets: SecretStore;
  logger: PluginLogger;
}
```

Plugin Context 必须是受控能力集合，不给插件裸 DB、裸 fs、裸 socket。

## 6. 插件类型

| 类型 | 示例 | 能力 |
| --- | --- | --- |
| Agent Provider | Codex, Claude, Gemini, GPT, OpenRouter, local model | 创建 Agent runtime，处理 Agent commands |
| Integration | GitHub, Vercel, Docker | Command handlers, webhooks, health |
| Notification | Telegram, Discord, Slack, WeChat | 发送通知，接收远程指令 |
| Tool Provider | MCP, filesystem, browser | 向 Agent 暴露工具 |
| Workflow Pack | CI/CD, test, deploy | workflow actions/templates |

## 7. Built-in Plugins

建议先做内置插件，不做市场：

```text
plugins/builtin/codex
plugins/builtin/github
plugins/builtin/docker
plugins/builtin/telegram
plugins/builtin/mcp
```

这些可以在同一 repo 内开发，仍通过 plugin SPI 接入，用来证明边界。

## 8. 插件权限模型

权限维度：

- network domain。
- workspace read/write。
- command type。
- secret key。
- notification send。
- webhook receive。
- docker access。
- deploy access。

风险级别：

```text
low       read-only status
medium    create PR, send notification
high      deploy, git push, docker mutate
critical  shell, delete files, secret access
```

High/Critical 默认需要人工确认或 admin policy。

## 9. 插件配置和 Secret

推荐表：

```sql
plugins (
  id text primary key,
  name text not null,
  version text not null,
  enabled integer not null,
  manifest_json text not null,
  created_at text not null,
  updated_at text not null
);

plugin_settings (
  plugin_id text primary key,
  settings_json text not null,
  updated_at text not null
);

plugin_secrets (
  id text primary key,
  plugin_id text not null,
  key text not null,
  encrypted_value text not null,
  created_at text not null,
  updated_at text not null
);
```

Secret 必须加密存储，不能进入普通 logs。

## 10. 远程控制插件

Telegram/微信远程控制不能直接执行用户文本。

流程：

```text
Telegram message
  -> plugin verifies sender/signature
  -> creates command with actor=remote identity
  -> policy check
  -> waiting_for_user if dangerous
  -> worker executes
  -> notification replies status
```

## 11. MCP 插件

MCP 应作为 Tool Provider：

```text
MCP Server
  -> tool registry
  -> agent tool permissions
  -> command/tool call audit
```

MCP tool 结果必须标记来源，并纳入 Prompt/Tool injection policy。

## 12. 验收标准

| 验收项 | 标准 |
| --- | --- |
| Manifest | 插件声明 commands/capabilities/permissions |
| Registry | 可启用/禁用插件 |
| Security | 插件无法绕过 Command Queue 和 policy |
| Health | 插件提供健康状态 |
| Secrets | 插件 secrets 加密且脱敏 |
| Built-in proof | 至少 GitHub 或 Telegram 通过插件边界接入 |

