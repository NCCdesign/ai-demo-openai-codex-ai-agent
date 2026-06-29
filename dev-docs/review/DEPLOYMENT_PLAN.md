# Deployment Plan

## 1. 部署目标

NCC AI OS 是长期运行的本地优先开发中枢。部署目标不是“能 npm run dev”，而是：

- 开机自动启动。
- 异常自动恢复。
- 本地和手机可访问。
- 可安全通过 Tunnel 远程访问。
- 数据和 artifact 可备份。
- 可升级和回滚。
- 不直接裸奔到公网。

## 2. 当前状态

当前已有：

- `docs/local-development.md`。
- server 默认 `127.0.0.1:4317`。
- web 默认 `localhost:3000`。
- LAN 可通过 `AIC_HOST=0.0.0.0`。
- SQLite 和 artifacts 在 `data/`。

缺少：

- Dockerfile。
- Docker Compose。
- Windows Service/Task Scheduler。
- systemd。
- PM2。
- Cloudflare Tunnel 文档。
- HTTPS/reverse proxy。
- backup/restore。
- update/rollback。

## 3. 部署风险

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 只有 dev 启动方式 | 无法长期无人值守 | 还在 MVP | 增加 production start scripts 和 service docs | M | docs, package scripts | P1 |
| 无自动恢复 | 崩溃后手机无法连接 | 没有 process manager | Windows 用 NSSM/Task Scheduler/PM2；Linux 用 systemd | M | docs/scripts | P1 |
| 无 Docker/Compose | 部署不可复现 | 缺少容器定义 | 增加 Dockerfile + compose，挂载 data/workspace | M | repo root | P1 |
| 无备份 | SQLite/artifacts 丢失不可恢复 | data/ 未治理 | backup script：SQLite backup + artifacts zip/rsync | M | scripts, docs | P1 |
| 无 HTTPS/Tunnel | 远程访问不安全 | 只支持 HTTP | Cloudflare Tunnel + Access 或 VPN | M | docs, config | P0 |
| 无生产配置校验 | 默认密码可能上线 | env 只给 example | production env validator | S-M | server | P0 |

## 4. Windows 部署

推荐路线：

1. `pnpm install --frozen-lockfile`
2. `pnpm build`
3. Server 使用 PM2 或 Windows Task Scheduler/NSSM。
4. Web 使用 Next standalone 或 `next start`。
5. 数据目录固定到用户目录或独立磁盘：

```text
AIC_DATABASE_PATH=C:\NCC-AI-OS\data\console.sqlite
AIC_ARTIFACT_ROOT=C:\NCC-AI-OS\data\artifacts
AIC_WORKSPACE_PATH=C:\Users\USER\Documents\Projects
```

Windows 自启动方案：

- 短期：PM2 + `pm2 startup`。
- 稳定：NSSM 注册 server/web 两个服务。
- 高级：单独打包成 Windows service。

## 5. Linux 部署

推荐：

```text
/opt/ncc-ai-os
/var/lib/ncc-ai-os/data
/var/log/ncc-ai-os
/etc/ncc-ai-os/env
```

systemd 服务：

```text
ncc-ai-os-server.service
ncc-ai-os-web.service
```

要求：

- Restart=always。
- WorkingDirectory=/opt/ncc-ai-os。
- EnvironmentFile=/etc/ncc-ai-os/env。
- 日志进入 journald 和文件。

## 6. Docker

推荐 Compose：

```text
services:
  server:
    build: .
    command: pnpm --filter @aic/server start
    volumes:
      - ./data:/app/data
      - /path/to/workspaces:/workspaces
  web:
    build: .
    command: pnpm --filter @aic/web start
    environment:
      NEXT_PUBLIC_API_BASE_URL: https://api.example.com
```

注意：

- Codex CLI、Docker socket、workspace mount 都需要明确权限。
- 不要默认挂载宿主机根目录。
- 如果管理 Docker，Docker socket 权限是高危，必须通过 command policy 和 approval。

## 7. Cloudflare Tunnel / HTTPS

推荐远程访问路径：

```text
iPhone
  -> Cloudflare Access
  -> Cloudflare Tunnel
  -> local reverse proxy
  -> web/server
```

要求：

- Access 登录保护。
- 只暴露 Web 入口。
- API 走同域 reverse proxy，避免 CORS 放大。
- 不直接开放 `4317` 到公网。
- 启用 HTTPS。

## 8. 域名

建议：

```text
os.ncc.design
```

或：

```text
ai.ncc.design
```

API 不建议单独公网域名，优先同域路径：

```text
https://os.ncc.design/api
```

## 9. 自动更新

短期：

- 手动 `git pull`。
- `pnpm install --frozen-lockfile`。
- `pnpm build`。
- restart services。

中期：

- `scripts/update.ps1`
- `scripts/update.sh`
- 自动备份后升级。
- 保留上一版本构建产物。

## 10. 自动备份

备份内容：

- SQLite DB。
- artifacts。
- logs。
- `.env` 的安全备份。
- plugin configs。

推荐命令：

```text
scripts/backup.ps1
scripts/backup.sh
```

策略：

- 每日自动备份。
- 保留 7 日 daily，4 周 weekly。
- 支持 restore dry-run。

## 11. 部署阶段计划

| 阶段 | 内容 | 优先级 |
| --- | --- | --- |
| MVP+ | production env validation，PM2/systemd docs | P0 |
| Beta | Dockerfile + Compose + backup scripts | P1 |
| Beta | Cloudflare Tunnel + Access guide | P1 |
| Release | one-command installer/update/rollback | P2 |
| Release | health-based auto-restart and alert | P1 |

## 12. 验收标准

| 验收项 | 标准 |
| --- | --- |
| Windows | 重启电脑后 server/web 自动恢复 |
| Linux | systemd 管理并自动重启 |
| Docker | compose up 后数据持久化 |
| Tunnel | 远程访问经过 HTTPS + Access |
| Backup | 能备份并恢复 SQLite/artifacts |
| Update | 升级前自动备份，失败可回滚 |
| Security | production 禁止默认密码/secret |

