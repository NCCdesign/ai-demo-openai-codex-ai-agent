# Observability

## 1. 当前可观测性结论

当前已有：

- `/api/health` 返回 `{ ok: true }`。
- Dashboard 显示 memoryPercent 和部分 CPU。
- Session logs。
- Git summary。
- Notifications placeholder。

这对 MVP 足够，但对长期值守的 NCC AI OS 不足。

## 2. 生产可观测性目标

Dashboard 需要实时显示：

- Agent。
- Backend。
- Database。
- GitHub。
- Docker。
- Tunnel。
- CPU。
- Memory。
- Disk。
- Network。
- Command Queue。
- Worker。
- Plugin。

系统还需要机器可读 health、metrics、audit。

## 3. Health Check 设计

推荐接口：

```text
GET /api/health/live
GET /api/health/ready
GET /api/health/dependencies
GET /api/metrics
```

含义：

- live：进程是否活着。
- ready：是否可服务请求。
- dependencies：DB、artifact path、workspace path、git、browser、agent adapters、tunnel、Docker、GitHub 等状态。
- metrics：给 dashboard 或未来 Prometheus 使用。

## 4. Health dependency 模型

```ts
interface DependencyHealth {
  id: string;
  name: string;
  status: "ok" | "degraded" | "down" | "unknown";
  checkedAt: string;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}
```

## 5. 问题清单

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/health` 只返回 ok | 依赖挂了仍显示健康 | health 未检查 DB/runtime | 拆 live/ready/dependencies | S-M | server | P1 |
| CPU 在 Windows 返回 null | Dashboard 指标不完整 | `os.loadavg` Windows 不可用 | Windows 用 process/os counters 或明确 unavailable | M | runtime | P2 |
| 缺少 disk/network 指标 | 长期日志/截图可能占满磁盘 | metrics 范围太小 | 增加 disk usage、artifact size、DB size | S-M | runtime, dashboard | P1 |
| 没有 Command Queue 指标 | 无法知道积压、失败率、等待人工 | Command Queue 未实现 | queue depth、oldest queued age、running count、failed count | M | command, dashboard | P0 |
| 没有 worker heartbeat | 后台任务死了页面不知道 | worker 未建模 | worker heartbeat 表和 dashboard status | M | server, db | P1 |
| 没有外部集成 health | GitHub/Docker/Tunnel 故障无法区分 | 插件未实现 | 每个插件提供 health check | M-L | plugin | P1 |
| 没有审计视图 | 安全事件和高风险操作不可追踪 | audit log 未建 | audit_events 表 + UI | M | security, db, web | P1 |

## 6. 指标建议

System：

- CPU percent。
- Memory percent。
- Disk free/used。
- Network availability。
- Process uptime。

Backend：

- request count/error count。
- p95 latency。
- active sockets。
- DB size。
- DB write failures。

Agent：

- active sessions。
- running runtimes。
- failed runtimes。
- waiting_for_user count。
- last heartbeat。

Command：

- queued count。
- running count。
- failed count。
- cancelled count。
- average duration。
- oldest queued age。

Logs/artifacts：

- logs rows count。
- logs write rate。
- artifact total size。
- screenshots count。

Integrations：

- GitHub auth status。
- Docker daemon status。
- Tunnel status。
- Vercel API status。
- Telegram/WeChat bridge status。
- MCP server status。

## 7. Dashboard Health UI

首页应有一块 Health Strip：

```text
Backend OK | DB OK | Queue 3 | Agent 1 running | Docker Down | Tunnel OK | Disk 72%
```

点击进入：

```text
/settings/health
```

显示 dependency table、最近错误和修复建议。

## 8. Alert / Notification

以下事件应触发通知：

- Command failed。
- Agent waiting_for_user。
- Agent runtime crashed。
- Worker heartbeat stale。
- DB write failed。
- Disk usage 超阈值。
- Tunnel disconnected。
- GitHub token expired。
- Docker daemon unavailable。

通知先进入 DB 和 UI；Web Push/Telegram/WeChat 通过插件扩展。

## 9. 验收标准

| 验收项 | 标准 |
| --- | --- |
| Health | live/ready/dependencies 三类接口可用 |
| Metrics | Dashboard 能显示 queue/agent/backend/db/disk 基础指标 |
| Worker | worker stale 能被发现 |
| Alert | command failed 和 waiting_for_user 能产生 notification |
| Audit | 高风险操作有 audit event |
| Unavailable | 不可用指标显示原因，不用假数据 |

