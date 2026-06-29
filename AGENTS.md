# NCC AI Development OS Agent 宪法

本仓库构建 **NCC AI Development OS**，简称 **NCC AI OS**。它是一个长期使用、本地优先的 AI 开发操作系统，不是 Codex Dashboard。后续 Agent 修改代码前，必须先读取 `dev-docs/README.md`，并把它当作当前项目真源索引。

守护标记：架构优先, 设计优先, 真源, 停止条件, 用户明确否定的概念必须删除, 立项期临时宪法, 禁止选项剧场, 框架, 验收.

## 工作模式

- 项目讨论和内部文档默认使用中文，除非用户明确要求英文。
- 架构优先，再写代码。不要从 UI、HTTP handler、prompt 或一次性脚本开始倒推架构。
- 遵守 ponytail 原则：懒是高效，不是粗心。写代码前优先删除、复用、标准库、平台能力和已安装依赖。
- 不增加不能形成真实边界的抽象。
- 状态、schema、鉴权、Agent 生命周期、日志、文件访问都只能有一个真源。
- 如果有意使用短期简化，并且存在已知上限，代码中必须用 `ponytail:` 标注上限和升级路径。

## 真源顺序

当信息冲突时，按以下顺序判断：

1. 当前代码、测试、schema、迁移、运行日志和命令输出。
2. 根目录 `AGENTS.md`。
3. `dev-docs/README.md` 以及它索引的 active docs。
4. 当前线程中的用户指令。
5. 旧笔记、草稿、生成产物只能作为历史背景。

## 产品边界

产品正式名称是 **NCC AI Development OS**，简称 **NCC AI OS**。它是一个本地优先的 AI 开发操作系统，用于从手机和桌面浏览器监控、控制长期运行的开发 Agent、项目、日志、部署钩子、通知和自动化工作流。

OpenAI Codex 只是第一个 Agent Provider。架构必须保持 provider-neutral，未来 Claude、Gemini、GPT、本地模型、GitHub、Vercel、Docker、Telegram、微信、MCP、知识库和 Workflow 都应通过平台模块或插件接入。

产品不是：

- 云端 SaaS 控制平面。
- 远程桌面替代品。
- 通用聊天克隆。
- Codex-only Dashboard。
- 第一阶段的插件市场。
- 没有服务端边界的任意文件系统或 Shell 暴露工具。

## 架构规则

- `packages/core` 拥有领域契约、状态枚举、DTO 和状态机。
- `packages/db` 拥有持久化和迁移。
- `apps/server` 拥有鉴权 API、Socket.IO、Agent Session、日志、产物和本地 Runtime 编排。
- `packages/agents` 拥有共享 SPI 背后的 Agent Adapter 实现。
- `packages/runtime` 拥有子进程、Git、文件监听、指标、浏览器截图等平台能力。
- `apps/web` 只拥有展示、PWA、响应式 UI、客户端 API/socket 绑定。
- UI 和 HTTP route 不得发明核心状态语义。
- Agent adapter 不得拥有数据库 schema、鉴权策略或跨 Agent 生命周期语义。

## 验证规则

- 非平凡逻辑必须留下一个可运行检查：小测试、脚本或构建门禁，逻辑坏了它要失败。
- 前端改动至少需要构建门禁；视觉/交互改动在可行时要用浏览器检查。
- API/socket/schema 改动需要契约级检查或聚焦测试。
- 安全敏感改动需要路径边界、鉴权或 token 行为检查。
- 在构建、集成、UI、文档和剩余风险全部关闭前，不得宣称 production-ready。

## Git 与文件卫生

- 除非用户明确要求，不得回滚用户改动。
- 不使用破坏性 git 命令。
- 如果提交，只暂存明确路径。
- 内部设计真源放在 `dev-docs/`。
- 用户可见的部署、API、运行文档放在 `docs/`。
