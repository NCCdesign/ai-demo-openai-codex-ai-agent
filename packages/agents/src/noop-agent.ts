import type { AgentAdapter, AgentStatus, StartAgentInput } from "@aic/core";

export class NoopAgentAdapter implements AgentAdapter {
  readonly type = "noop";
  private readonly statuses = new Map<string, AgentStatus>();

  async start(input: StartAgentInput) {
    this.statuses.set(input.sessionId, "waiting_for_user");
    return {
      sessionId: input.sessionId,
      status: "waiting_for_user" as const
    };
  }

  async sendMessage(sessionId: string): Promise<void> {
    this.statuses.set(sessionId, "waiting_for_user");
  }

  async stop(sessionId: string): Promise<void> {
    this.statuses.set(sessionId, "stopped");
  }

  async getStatus(sessionId: string): Promise<AgentStatus> {
    return this.statuses.get(sessionId) ?? "idle";
  }
}

