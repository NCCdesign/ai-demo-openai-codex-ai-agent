# NCC AI Development OS

NCC AI Development OS, 简称 NCC AI OS，是一个本地优先的 AI 开发操作系统。它用于在个人电脑长期运行 Codex 或其他 AI Agent 时，通过桌面或手机浏览器查看进度、查看日志、发送命令、查看文件变更和截图。

它不是云端 SaaS，不是远程桌面替代品，也不是 Codex-only Dashboard。Codex 只是第一个 Agent Provider；未来 Claude、GPT、Gemini、GitHub、Vercel、Docker、Telegram、微信、MCP、知识库和自动化工作流都应通过平台模块或插件接入。

## 当前能力

- Next.js PWA 前端，移动端优先。
- Fastify + Socket.IO 本地服务端。
- SQLite 持久化。
- 登录、本地访问令牌、退出登录。
- 总览、聊天、实时日志、文件修改、截图、设置页面。
- Codex 兼容进程适配器和空跑智能体适配器。
- Command Queue 基线：Continue、Pause、Resume、Stop、Cancel 统一入队后执行。
- Git 摘要、文件差异、日志下载、截图产物。
- 架构真源文档位于 `dev-docs/`。

## 快速开始

```powershell
pnpm install
pnpm approve-builds esbuild sharp
pnpm --filter @aic/server start
pnpm --filter @aic/web dev
```

默认地址：

- Web: `http://localhost:3000`
- API: `http://127.0.0.1:4317`

默认登录：

- 邮箱：`admin@example.local`
- 密码：`change-me`

日常使用前请通过环境变量覆盖默认密码和令牌密钥。不要把本地数据库、`.env`、截图产物或访问令牌提交到仓库。

## 手机访问

同一 Wi-Fi 下测试手机访问时，后端需要显式监听局域网：

```powershell
$env:AIC_HOST = "0.0.0.0"
pnpm --filter @aic/server start
pnpm --filter @aic/web dev
```

然后用电脑局域网 IP 打开，例如：

```text
http://192.168.2.101:3000
```

只在可信局域网中这样运行，不要直接暴露到公网。

## 检查

```powershell
pnpm check
pnpm build
```

注意：不要并行运行 `pnpm check` 和 `pnpm build`，Next.js `.next` 输出目录会产生竞争，可能导致临时构建失败。

## 项目结构

```text
apps/web        Next.js PWA 前端
apps/server     本地 API / Socket.IO 服务端
packages/core   领域模型、DTO、状态机、Socket 契约
packages/db     SQLite 迁移和仓储
packages/agents 智能体适配器
packages/runtime 平台运行能力：进程、Git、指标、截图
dev-docs/       内部架构和验收真源
docs/           本地运行文档
```

## 审查入口

给其他 AI 或工程师审查时，建议先读：

- `AGENTS.md`
- `dev-docs/README.md`
- `dev-docs/architecture.md`
- `dev-docs/api-contract.md`
- `dev-docs/acceptance.md`
- `docs/local-development.md`
