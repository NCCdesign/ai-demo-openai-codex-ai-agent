# Logging Plan

## 1. 当前日志状态

当前日志能力：

- Agent stdout/stderr/system/agent lines 存入 SQLite `logs` 表。
- Logs 页面支持搜索、自动滚动、下载。
- Server 使用 Fastify logger 输出到进程日志。
- Screenshot/File refresh 等失败会写 session system log。

结论：MVP 的 session log 已可用，但还不是生产日志系统。

## 2. 目标日志体系

NCC AI OS 需要两类日志：

1. 用户可见运行日志：Agent、任务、命令、终端、部署、测试。
2. 运维诊断日志：server、system、security、plugin、worker。

推荐文件布局：

```text
logs/
  agent.log
  system.log
  server.log
  command.log
  terminal.log
  security.log
  plugin.log
```

SQLite 保存可查询事件和近期日志，文件日志保存可轮转的运维证据。两者不是互相替代。

## 3. 日志等级

```text
DEBUG
INFO
WARN
ERROR
```

规范：

- DEBUG：开发诊断，默认生产关闭。
- INFO：状态变化、命令开始/完成、Agent lifecycle。
- WARN：降级、重试、不可用但系统可继续。
- ERROR：命令失败、Agent 崩溃、安全拒绝、外部服务失败。

## 4. 问题清单

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 只有 session logs，没有系统日志文件规范 | Server/worker/plugin 问题难排查 | Fastify logger 未纳入统一计划 | 引入 structured logger，输出 server/system/security 文件 | M | server, docs | P1 |
| SQLite logs 无限增长 | 长期使用数据库膨胀 | 无 retention/rotation | 增加 retention policy、归档和清理任务 | M | db, server | P1 |
| 没有 command.log | 无法审计谁触发了什么动作 | Command Queue 未实现 | command events 同时进入 command log | M | command, logging | P0 |
| stdout/stderr 逐行写库和推送 | 大输出可能造成 IO 压力 | 没有 batch/backpressure | 增加 batch write、rate limit、truncation marker | M | runtime, db, socket | P1 |
| 日志无 requestId/commandId | 跨 API、worker、agent 难关联 | 日志格式未结构化 | 所有日志带 requestId/sessionId/commandId/workspaceId | M | server, runtime | P1 |
| 没有敏感信息脱敏 | Token/API key 可能进入日志 | Agent 输出和 env 错误直接记录 | Logger 加 redaction：token、secret、authorization、api key | S-M | server, runtime | P0 |
| 中文日志乱码 | 可读性差，公开审查负面 | 编码链路不统一 | 全项目 UTF-8，添加 mojibake scan | S | all text files | P1 |

## 5. 结构化日志格式

推荐 JSON Lines：

```json
{
  "ts": "2026-06-29T00:00:00.000Z",
  "level": "INFO",
  "source": "command-worker",
  "event": "command.started",
  "requestId": "req_x",
  "commandId": "cmd_x",
  "sessionId": "ses_x",
  "workspaceId": "wks_x",
  "message": "Command started"
}
```

用户可见日志可以继续存 line，但内部日志必须结构化。

## 6. 日志轮转与归档

短期本地策略：

```text
max file size: 10 MB
max files per type: 10
SQLite logs retention: 30 days by default
artifacts retention: manual / per workspace policy
archive path: data/archive/logs/YYYY-MM/
```

长期策略：

- 可导出 log bundle。
- 可按 session/workspace 清理。
- 可保留 failed command 的关键日志更久。
- 可接入外部 log sink。

## 7. 自动清理

新增定时任务：

```text
cleanup.logs
cleanup.artifacts
cleanup.old_commands
cleanup.expired_tokens
```

这些也应通过 Command/Worker 或 Scheduler 管理，并写入 system log。

## 8. 日志下载

现有 `GET /api/sessions/:id/logs/download` 保留。

新增：

```text
GET /api/logs/server/download
GET /api/logs/command/download
GET /api/sessions/:id/log-bundle
GET /api/commands/:id/logs/download
```

下载权限需要 RBAC 和审计。

## 9. 验收标准

| 验收项 | 标准 |
| --- | --- |
| 文件日志 | server/system/command/security 至少有可轮转文件 |
| 结构化 | 内部日志为 JSONL，包含 trace fields |
| 脱敏 | Authorization/token/secret 不明文落盘 |
| 清理 | 可配置 retention，清理动作有日志 |
| UI | Logs 页面可看 session logs，不被系统日志污染 |
| 导出 | session log bundle 可用于交给另一个 AI 审查 |

