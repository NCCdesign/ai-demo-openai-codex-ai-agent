import type { AgentRuntimeInstance, AgentStreamEvent, AgentStreamEventDraft, AgentStreamEventType, Command, LogLine } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";

export class AgentStreamService {
  constructor(
    private readonly repo: ConsoleRepository,
    private readonly onEvent?: (event: AgentStreamEvent) => void
  ) {}

  append(input: {
    sessionId: string;
    type: AgentStreamEventType;
    payload: Record<string, unknown>;
    commandId?: string | null;
    logId?: number | null;
  }): AgentStreamEvent {
    const event = this.repo.appendAgentStreamEvent(input);
    this.onEvent?.(event);
    return event;
  }

  appendDraft(event: AgentStreamEventDraft): AgentStreamEvent {
    return this.append({
      sessionId: event.sessionId,
      type: event.type,
      payload: event.payload,
      commandId: event.commandId,
      logId: event.logId
    });
  }

  appendLog(log: LogLine): AgentStreamEvent {
    return this.append({
      sessionId: log.sessionId,
      type: log.level === "error" ? "error" : "token",
      payload: {
        text: log.line,
        stream: log.stream,
        level: log.level
      },
      logId: log.id
    });
  }

  appendCommand(command: Command): AgentStreamEvent {
    return this.append({
      sessionId: command.sessionId,
      type: command.status === "failed" ? "error" : "progress",
      payload: {
        commandId: command.id,
        commandType: command.type,
        status: command.status,
        errorCode: command.errorCode,
        message: command.errorMessage ?? `Command ${command.type} is ${command.status}`
      },
      commandId: command.id
    });
  }

  appendRuntimeStatus(runtime: AgentRuntimeInstance): AgentStreamEvent {
    return this.append({
      sessionId: runtime.sessionId,
      type: "status_change",
      payload: {
        runtimeId: runtime.id,
        status: runtime.status,
        heartbeatAt: runtime.heartbeatAt,
        lastError: runtime.lastError
      }
    });
  }

  list(input: { sessionId: string; cursor?: number; limit?: number }): { events: AgentStreamEvent[]; nextCursor: number | null } {
    const events = this.repo.listAgentStreamEvents(input);
    return {
      events,
      nextCursor: events.length ? events[events.length - 1]!.id : null
    };
  }
}
