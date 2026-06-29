# Dashboard Review

## 1. 当前 Dashboard 状态

当前 Dashboard 展示：

- 最近 Session。
- 当前状态。
- 运行时间。
- CPU/Memory 部分指标。
- Git branch/commit。
- 最近文件修改。
- Workspace path。
- DB-backed notifications。
- 10 秒自动刷新。

结论：当前 Dashboard 满足 MVP 远程查看需求，但还不是 NCC AI OS 的 Operations Center。

## 2. Dashboard 的目标定位

NCC AI OS 首页应该是“AI 开发操作中心”，不是单 Session 摘要页。

它应同时回答：

- 哪些项目正在被 Agent 操作？
- 哪些 Agent 正在运行、等待、失败？
- 哪些命令排队、阻塞、需要人工确认？
- 后端、数据库、Socket、GitHub、Docker、Tunnel 是否健康？
- 最近发生了哪些重要事件？
- 哪些修改尚未 commit / push / deploy？

## 3. 问题清单

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 以 latest session 为中心 | 多项目、多 Agent 后首页失真 | `repo.findLatestSession()` 驱动 dashboard | Dashboard 改为 workspace/agent/command 总览，latest session 只是一张卡 | M | db, server, web | P1 |
| 10 秒轮询为主 | 实时性差，手机耗电，后端多余请求 | MVP 简化自动刷新 | WebSocket 推送 dashboard events，REST 只做初始和恢复 | M | socket, web, server | P1 |
| 缺少 Command Queue 视图 | 用户不知道任务是否排队、卡住、失败 | 没有 command 模型 | 首页加入 active commands / blocked commands / approvals | M | db, server, web | P0 |
| 缺少项目列表 | 未来所有项目无法一眼管理 | Workspace API 只读且 UI 固定默认项目 | Dashboard 增加 Workspace overview 和 project health | M | db, server, web | P1 |
| 指标不完整 | 后端、DB、Docker、Tunnel 挂了无法快速定位 | 当前只取 OS memory 和 Git summary | 增加 health dependency checks | M | server, runtime, web | P1 |
| 没有 Screenshot 最新预览 | 远程查看 UI 状态不够直观 | Screenshot 是单独页面 | Dashboard 显示最新 artifact preview 和 capture command | S-M | web, server | P2 |
| 没有 Git 操作状态 | 无法知道 modified/untracked/ahead/behind | 当前只 branch/commit | 增加 working tree status、ahead/behind、last commit | M | runtime, server, web | P1 |
| 通知只是测试入口 | 不能代表真实任务完成/报错/等待人工 | Notification service 还未接入 lifecycle | Session/command status changes 触发真实 notification | M | server, socket, web | P1 |

## 4. 推荐 Dashboard 信息架构

```text
Overview
  - System health
  - Active agents
  - Running commands
  - Waiting for user
  - Recent failures

Projects
  - Workspace cards
  - Git state
  - Active sessions
  - Last screenshot

Queue
  - queued/running/blocked/failed commands
  - approval required

Activity
  - conversation events
  - logs highlights
  - file changes
  - deploy/test results

Integrations
  - GitHub
  - Docker
  - Vercel
  - Tunnel
  - Telegram/WeChat bridge
```

## 5. API 建议

```text
GET /api/dashboard/overview
GET /api/dashboard/activity?cursor=
GET /api/dashboard/health
GET /api/workspaces/:id/overview
```

Socket events：

```text
dashboard:overview_updated
dashboard:health_changed
command:status_changed
agent:status_changed
workspace:changed
```

## 6. 手机体验要求

| 区域 | iPhone 优先建议 |
| --- | --- |
| 顶部状态 | 用一屏内可扫视的 3-4 个关键状态，不堆图表 |
| Command Queue | 失败/等待人工必须在第一屏可见 |
| Logs | 首页只显示摘要，详情跳 logs 页面 |
| Screenshot | 最新截图可点开，不默认加载所有大图 |
| Git | 显示 `clean/dirty/ahead/behind`，Diff 进入 Files |
| Notifications | 与系统通知保持同一状态语义 |

## 7. 推荐开发顺序

| 顺序 | 动作 | 优先级 |
| --- | --- | --- |
| 1 | 接入 Command Queue 卡片 | P0 |
| 2 | Dashboard REST 从 latest session 改为 overview aggregate | P1 |
| 3 | Socket 推送 dashboard update，降低轮询依赖 | P1 |
| 4 | Health dependency checks | P1 |
| 5 | 多 Workspace overview | P1 |
| 6 | 最新截图和 Git working tree 状态 | P2 |

