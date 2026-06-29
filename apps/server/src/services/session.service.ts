import type { AgentRuntimeEvent, CreateMessageRequest, LogLine, Message, Session, SessionStatus } from "@aic/core";
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
      throw new Error(`Agent does not exist or is disabled: ${input.agentId}`);
    }
    if (!workspace) {
      throw new Error(`Workspace does not exist: ${input.workspaceId}`);
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

  createUserMessage(sessionId: string, request: CreateMessageRequest): Message {
    const session = this.requireSession(sessionId);
    this.requireAgent(session.agentId);
    return this.repo.createMessage({
      sessionId,
      role: "user",
      content: request.content,
      contentFormat: request.contentFormat ?? "markdown"
    });
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    const agent = this.requireAgent(session.agentId);
    const adapter = this.agents.get(agent.type);
    await adapter.stop(sessionId);
    this.repo.updateSessionStatus(sessionId, "stopped");
  }

  async sendAgentControl(sessionId: string, content: string, nextStatus: SessionStatus): Promise<LogLine> {
    const session = this.requireSession(sessionId);
    const agent = this.requireAgent(session.agentId);
    const adapter = this.agents.get(agent.type);
    await adapter.sendMessage(sessionId, content);
    this.repo.updateSessionStatus(sessionId, nextStatus);
    return this.repo.appendLog({
      sessionId,
      stream: "agent",
      level: "info",
      line: `${agent.name} received control command: ${content}`
    });
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
      throw new Error(`Session does not exist: ${sessionId}`);
    }
    return session;
  }

  private requireAgent(agentId: string) {
    const agent = this.repo.findAgent(agentId);
    if (!agent) {
      throw new Error(`Agent does not exist or is disabled: ${agentId}`);
    }
    return agent;
  }
}
