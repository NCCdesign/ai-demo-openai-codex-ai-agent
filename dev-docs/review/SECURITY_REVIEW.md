# Security Review

## 1. 总体结论

当前安全水平适合可信本机或可信 LAN 的 MVP，不适合公网直接暴露。

已有优点：

- 必须登录。
- Bearer token 存 hash。
- token plaintext 只在创建时返回。
- logout 可撤销当前 token。
- screenshot URL 限制为本地地址。
- workspace path helper 存在。

主要风险：

- 默认密码和 token secret。
- CORS 过宽。
- 无 rate limit。
- 无 RBAC/permission policy。
- Command/Agent/Runtime 缺少统一安全策略。
- 无 prompt/tool injection 防线。
- 无部署级 HTTPS/Cloudflare Access 强制方案。

## 2. Critical

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 生产环境允许默认 admin 密码和 token secret | 一旦暴露端口即可能被接管 | `loadConfig` 默认 `change-me` | 增加 `AIC_ENV=production` 时启动失败；首次启动 bootstrap 强制改密 | S | server config | P0 |
| 所有控制动作未经过统一 Command Policy | Agent 可被滥用执行高风险动作 | 当前 route 分散执行 service | Command Queue + policy gate；高风险命令需要 approval | M-L | server, db, web | P0 |
| 不能直接公网暴露 | 未授权访问、暴力破解、命令滥用 | 无 HTTPS/RBAC/rate limit/origin policy | 文档和启动检查明确禁止直接公网；推荐 Cloudflare Access + HTTPS | S-M | docs, server config | P0 |
| CORS `origin: true` | 任意 origin 可调用 API，若 token 泄露危害扩大 | 本地开发便利配置 | 生产改为 allowlist，默认只允许 web origin | S | server | P0 |

## 3. High

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 无 login/token rate limit | 暴力破解和 token 滥用 | Fastify 未加限流 | login、token、command route 限流 | S-M | server | P0 |
| 无 RBAC/Authorization policy | 多用户后 operator 可执行 admin 操作 | 只有 role 字段，无策略 | 定义 roles/scopes：admin/operator/viewer/plugin | M | core, server | P1 |
| Artifact 下载缺少细粒度授权 | 多 workspace/user 后可能越权下载 | artifact id 直接读取 | 按 session/workspace/user 检查 | S-M | server, db | P1 |
| Socket room join 不校验资源权限 | 订阅别人 session logs | 当前只校验 token | join 前查 session/workspace 权限 | S | socket, db | P1 |
| Command/Path traversal 防线未统一 | 文件和 shell 功能扩展后容易漏检 | helper 存在但未成为 policy | 所有文件操作通过 workspace policy | M | runtime, server | P0 |
| Shell/Command injection 风险 | Terminal/Docker/deploy 接入后危险 | Process runner 可执行命令，未来输入复杂 | 禁止自由 shell；使用 argv allowlist；高风险需 approval | M | runtime, command | P0 |
| Prompt/Tool injection 未建模 | Agent 可能被网页/日志/文件诱导泄露密钥或执行危险工具 | Agent tool policy 未建立 | tool permission、secret isolation、human approval、untrusted content labels | L | agents, plugins, security | P1 |

## 4. Medium

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| Token 存在 localStorage | XSS 后 token 可被取走 | PWA 简化实现 | 继续禁 HTML 渲染；后续考虑 httpOnly cookie + CSRF | M | web, server | P2 |
| Markdown 自研 parser 无 HTML 执行是好事，但功能有限 | 未来换 parser 后可能引入 XSS | 当前无 sanitizer 体系 | 若引入 Markdown 库，必须 sanitize HTML 或禁 HTML | S-M | web | P1 |
| 缺少 secret management | API keys 可能写入 config/logs | `.env` 简化 | secret redaction、env validation、plugin secret store | M | server, plugins | P1 |
| 无 audit log | 事后无法追踪谁执行了 deploy/stop/push | audit table 未建 | audit_events 表，记录高风险操作 | M | db, server, web | P1 |
| 文件上传安全未设计 | 恶意文件、超大文件、路径攻击 | 还未实现上传 | size/type/path/scan/quarantine policy | M | server, web | P1 |
| HTTPS 未实现 | LAN/Tunnel 传输可能被截获 | 本地 MVP | Cloudflare Tunnel 或 reverse proxy TLS | M | deployment docs | P1 |

## 5. Low

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| Security headers 未配置 | 浏览器侧防护不足 | Fastify 默认 | CSP、X-Frame-Options、Referrer-Policy | S | server/web | P2 |
| Session/token 管理 UI 简单 | 用户不易发现异常 token | MVP settings | 显示 last IP/user agent/revoke all | S-M | db, web | P2 |
| 日志脱敏未统一 | 偶发泄露敏感字段 | logger 未封装 | redaction middleware | S-M | logging | P1 |

## 6. 推荐安全架构

```text
AuthN
  bearer token now
  OAuth later

AuthZ
  roles + scopes + command policy

Command Security
  validate payload
  policy check
  approval for dangerous commands
  audit event

Runtime Security
  workspace boundary
  argv allowlist
  no arbitrary shell by default
  secret redaction

Remote Access
  localhost default
  LAN explicit
  public only through Cloudflare Access / VPN / reverse proxy TLS
```

## 7. Prompt / Tool Injection Policy

必须把以下内容标记为 untrusted：

- 网页内容。
- 外部 issue/PR。
- 用户上传文件。
- Agent 读取的日志。
- 第三方插件返回内容。

Agent tool 执行前检查：

- 工具是否允许该 Agent 使用。
- 是否访问 secret。
- 是否修改文件。
- 是否触发外部网络。
- 是否需要人工确认。

## 8. 验收标准

| 验收项 | 标准 |
| --- | --- |
| Production boot | 默认密码/secret 下无法以 production 启动 |
| Rate limit | login/token/command 有限流 |
| Origin | production 有 allowlist |
| Command policy | 所有动作经过统一 policy |
| Audit | 高风险命令可追踪 actor/payload/result |
| Path | 文件操作不能逃出 workspace |
| Socket | room join 有授权检查 |
| Logs | secret/token 不明文记录 |

