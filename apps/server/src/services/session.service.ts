import type { AgentRuntimeEvent, AgentStreamEventDraft, CreateMessageRequest, LogLine, Message, Session, SessionStatus } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";
import { AgentRegistry } from "@aic/agents";
import type { AgentRuntimeService } from "./agent-runtime.service.js";

export class SessionService {
  constructor(
    private readonly repo: ConsoleRepository,
    private readonly agents: AgentRegistry,
    private readonly runtimes?: AgentRuntimeService,
    private readonly onLog?: (log: LogLine) => void,
    private readonly onStreamEvent?: (event: AgentStreamEventDraft) => void
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
    this.runtimes?.createForSession({
      sessionId: session.id,
      workspaceId: workspace.id,
      agentId: agent.id,
      pid: null,
      sessionStatus: session.status
    });
    const adapter = this.agents.get(agent.type);
    try {
      const handle = await adapter.start({
        sessionId: session.id,
        workspacePath: workspace.path,
        onEvent: (event) => this.persistAgentEvent(event),
        onStreamEvent: (event) => this.persistAgentStreamEvent(session.id, event),
        onStatus: (status) => this.updateSessionAndRuntimeStatus(session.id, status)
      });
      this.updateSessionAndRuntimeStatus(session.id, handle.status, { pid: handle.pid ?? null, lastError: handle.lastError });
      return { ...session, status: handle.status };
    } catch (error) {
      this.updateSessionAndRuntimeStatus(session.id, "failed", {
        lastError: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
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
    this.updateSessionAndRuntimeStatus(sessionId, "stopped");
  }

  async restartSession(sessionId: string): Promise<Session> {
    const session = this.requireSession(sessionId);
    const agent = this.requireAgent(session.agentId);
    const workspace = this.requireWorkspace(session.workspaceId);
    const adapter = this.agents.get(agent.type);
    await adapter.stop(sessionId);
    this.updateSessionAndRuntimeStatus(sessionId, "starting", { pid: null, lastError: null });
    this.appendLog({
      sessionId,
      stream: "system",
      level: "info",
      line: `${agent.name} restarting`
    });
    try {
      const handle = await adapter.start({
        sessionId,
        workspacePath: workspace.path,
        onEvent: (event) => this.persistAgentEvent(event),
        onStreamEvent: (event) => this.persistAgentStreamEvent(session.id, event),
        onStatus: (status) => this.updateSessionAndRuntimeStatus(session.id, status)
      });
      this.updateSessionAndRuntimeStatus(session.id, handle.status, {
        pid: handle.pid ?? null,
        lastError: handle.lastError ?? (handle.status === "failed" ? undefined : null)
      });
      return this.requireSession(session.id);
    } catch (error) {
      this.updateSessionAndRuntimeStatus(session.id, "failed", {
        pid: null,
        lastError: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async sendAgentControl(sessionId: string, content: string, nextStatus: SessionStatus): Promise<LogLine> {
    const session = this.requireSession(sessionId);
    const agent = this.requireAgent(session.agentId);
    const adapter = this.agents.get(agent.type);
    await adapter.sendMessage(sessionId, content);
    this.updateSessionAndRuntimeStatus(sessionId, nextStatus);
    return this.appendLog({
      sessionId,
      stream: "agent",
      level: "info",
      line: `${agent.name} received control command: ${content}`
    });
  }

  async pauseSession(sessionId: string): Promise<LogLine> {
    const session = this.requireSession(sessionId);
    const agent = this.requireAgent(session.agentId);
    const adapter = this.agents.get(agent.type);
    await adapter.pause(sessionId);
    this.updateSessionAndRuntimeStatus(sessionId, "waiting_for_user");
    return this.appendLog({
      sessionId,
      stream: "agent",
      level: "info",
      line: `${agent.name} paused`
    });
  }

  async resumeSession(sessionId: string): Promise<LogLine> {
    const session = this.requireSession(sessionId);
    const agent = this.requireAgent(session.agentId);
    const adapter = this.agents.get(agent.type);
    await adapter.resume(sessionId);
    this.updateSessionAndRuntimeStatus(sessionId, "running");
    return this.appendLog({
      sessionId,
      stream: "agent",
      level: "info",
      line: `${agent.name} resumed`
    });
  }

  private persistAgentEvent(event: AgentRuntimeEvent): LogLine {
    this.runtimes?.heartbeat(event.sessionId);
    const log = this.appendLog({
      sessionId: event.sessionId,
      stream: event.stream,
      level: event.level,
      line: event.line
    });
    return log;
  }

  private appendLog(input: { sessionId: string; stream: LogLine["stream"]; level: LogLine["level"]; line: string }): LogLine {
    const log = this.repo.appendLog(input);
    this.onLog?.(log);
    return log;
  }

  private persistAgentStreamEvent(sessionId: string, event: AgentStreamEventDraft): void {
    this.onStreamEvent?.({ ...event, sessionId });
  }

  private updateSessionAndRuntimeStatus(sessionId: string, status: SessionStatus, input: { pid?: number | null; lastError?: string | null } = {}): void {
    this.repo.updateSessionStatus(sessionId, status, input.lastError);
    this.runtimes?.syncSessionStatus(sessionId, status, input);
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

  private requireWorkspace(workspaceId: string) {
    const workspace = this.repo.findWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace does not exist: ${workspaceId}`);
    }
    return workspace;
  }
}
