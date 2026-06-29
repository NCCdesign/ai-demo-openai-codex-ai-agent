import type { AgentRuntimeEvent, CreateMessageRequest, LogLine, Message, Session } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";
import { AgentRegistry } from "@aic/agents";

export class SessionService {
  constructor(
    private readonly repo: ConsoleRepository,
    private readonly agents: AgentRegistry,
    private readonly onLog?: (log: LogLine) => void
  ) {}

  async createSession(input: { workspaceId: string; agentId: string; title?: string; userId: string }): Promise<Session> {
    const agent = this.repo.findAgent(input.agentId);
    const workspace = this.repo.findWorkspace(input.workspaceId);
    if (!agent) {
      throw new Error(`Agent 未启用或不存在：${input.agentId}`);
    }
    if (!workspace) {
      throw new Error(`项目不存在：${input.workspaceId}`);
    }

    const session = this.repo.createSession({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      title: input.title,
      createdBy: input.userId,
      status: "starting"
    });
    const adapter = this.agents.get(agent.type);
    const handle = await adapter.start({
      sessionId: session.id,
      workspacePath: workspace.path,
      onEvent: (event) => this.persistAgentEvent(event),
      onStatus: (status) => this.repo.updateSessionStatus(session.id, status)
    });
    this.repo.updateSessionStatus(session.id, handle.status);
    return { ...session, status: handle.status };
  }

  async addUserMessage(sessionId: string, request: CreateMessageRequest): Promise<{ message: Message; log: LogLine }> {
    const session = this.requireSession(sessionId);
    const agent = this.requireAgent(session.agentId);
    const message = this.repo.createMessage({
      sessionId,
      role: "user",
      content: request.content,
      contentFormat: request.contentFormat ?? "markdown"
    });
    const adapter = this.agents.get(agent.type);
    await adapter.sendMessage(sessionId, request.content);
    const log = this.repo.appendLog({
      sessionId,
      stream: "agent",
      level: "info",
      line: `${agent.name} 已接收消息`
    });
    return { message, log };
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    const agent = this.requireAgent(session.agentId);
    const adapter = this.agents.get(agent.type);
    await adapter.stop(sessionId);
    this.repo.updateSessionStatus(sessionId, "stopped");
  }

  private persistAgentEvent(event: AgentRuntimeEvent): LogLine {
    const log = this.repo.appendLog({
      sessionId: event.sessionId,
      stream: event.stream,
      level: event.level,
      line: event.line
    });
    this.onLog?.(log);
    return log;
  }

  private requireSession(sessionId: string): Session {
    const session = this.repo.findSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在：${sessionId}`);
    }
    return session;
  }

  private requireAgent(agentId: string) {
    const agent = this.repo.findAgent(agentId);
    if (!agent) {
      throw new Error(`Agent 未启用或不存在：${agentId}`);
    }
    return agent;
  }
}
