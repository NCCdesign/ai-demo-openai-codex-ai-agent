import type { Command, CommandType, LogLine, Session } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";
import type { CommandService } from "./command.service.js";
import type { AgentRuntimeService } from "./agent-runtime.service.js";

export interface RemoteConsoleCommandResult {
  command: Command;
  message: string;
}

export class RemoteConsoleService {
  constructor(
    private readonly repo: ConsoleRepository,
    private readonly runtimes: AgentRuntimeService,
    private readonly commands: CommandService,
    private readonly onCommandCreated?: (command: Command) => void
  ) {}

  getStatusText(sessionId?: string): string {
    const session = this.resolveSession(sessionId);
    if (!session) {
      return "当前没有 Agent Session。";
    }
    const runtime = this.runtimes.findBySession(session.id);
    const workspace = this.repo.findWorkspace(session.workspaceId);
    const agent = this.repo.findAgent(session.agentId);
    const latestLogs = this.repo.listLogs(session.id, 0, 5).logs.slice(-5);
    const latestLog = latestLogs.at(-1);

    return [
      `Session: ${session.id}`,
      `标题: ${session.title ?? "-"}`,
      `Agent: ${agent?.name ?? session.agentId}`,
      `状态: ${runtime?.status ?? session.status}`,
      `Heartbeat: ${runtime?.heartbeatAt ?? "-"}`,
      `项目: ${workspace?.path ?? session.workspaceId}`,
      `最近日志: ${latestLog ? latestLog.line : "-"}`
    ].join("\n");
  }

  getRecentLogsText(input: { sessionId?: string; limit?: number } = {}): string {
    const session = this.resolveSession(input.sessionId);
    if (!session) {
      return "当前没有 Agent Session。";
    }
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 20), 1), 50);
    const logs = this.repo.listLogs(session.id, 0, 2000).logs.slice(-limit);
    if (!logs.length) {
      return `Session ${session.id} 暂无日志。`;
    }
    return logs.map(formatLogLine).join("\n");
  }

  createControlCommand(input: {
    type: CommandType;
    sessionId?: string;
    text?: string;
    userId?: string | null;
  }): RemoteConsoleCommandResult {
    const session = this.resolveSession(input.sessionId);
    if (!session) {
      throw new Error("No active session is available for remote command.");
    }
    const command = this.commands.createCommand({
      type: input.type,
      sessionId: session.id,
      source: "telegram",
      userId: input.userId ?? null,
      payload: input.text ? { text: input.text } : undefined
    });
    this.onCommandCreated?.(command);
    return {
      command,
      message: `已入队: ${command.type}\nCommand: ${command.id}\nSession: ${command.sessionId}`
    };
  }

  private resolveSession(sessionId?: string): Session | null {
    if (sessionId) {
      return this.repo.findSession(sessionId);
    }
    return this.repo.findLatestSession();
  }
}

function formatLogLine(log: LogLine): string {
  const level = log.level ? `/${log.level}` : "";
  return `[${log.id}] ${log.stream}${level}: ${log.line}`;
}
