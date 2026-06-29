import type { Command, CommandSource, CommandType } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";

export class CommandService {
  constructor(private readonly repo: ConsoleRepository) {}

  createCommand(input: {
    type: CommandType;
    sessionId: string;
    source: CommandSource;
    userId: string | null;
    payload?: Record<string, unknown>;
  }): Command {
    const session = this.repo.findSession(input.sessionId);
    if (!session) {
      throw new Error(`Session does not exist: ${input.sessionId}`);
    }
    const workspace = this.repo.findWorkspace(session.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace does not exist: ${session.workspaceId}`);
    }
    const agent = this.repo.findAgent(session.agentId);
    if (!agent) {
      throw new Error(`Agent does not exist or is disabled: ${session.agentId}`);
    }
    return this.repo.createCommand({
      type: input.type,
      source: input.source,
      sessionId: session.id,
      workspaceId: workspace.id,
      agentId: agent.id,
      userId: input.userId,
      payload: input.payload
    });
  }

  listCommands(input: { sessionId?: string; limit?: number }) {
    return this.repo.listCommands(input);
  }

  getCommand(commandId: string): Command | null {
    return this.repo.findCommand(commandId);
  }
}
