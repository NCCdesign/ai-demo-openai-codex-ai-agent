import type { AgentAdapter, AgentRuntimeEvent, AgentStatus, StartAgentInput } from "@aic/core";
import { startProcess, type RunningProcess } from "@aic/runtime";
import { codexJsonlToStreamEvent } from "./codex-jsonl-stream.js";

export interface CodexProcessAgentOptions {
  command?: string;
  args?: string[];
}

export class CodexProcessAgentAdapter implements AgentAdapter {
  readonly type = "codex";
  private readonly sessions = new Map<string, { process: RunningProcess; status: AgentStatus; stopping: boolean }>();

  constructor(private readonly options: CodexProcessAgentOptions = {}) {}

  async start(input: StartAgentInput) {
    const command = this.options.command ?? process.env.AIC_CODEX_COMMAND ?? "codex";
    const args = this.options.args ?? parseArgs(process.env.AIC_CODEX_ARGS);

    let currentStatus: AgentStatus = "running";
    input.onStatus?.(currentStatus);
    const running = startProcess({
      command,
      args,
      cwd: input.workspacePath,
      onStdout: (line) => {
        input.onEvent?.(event(input.sessionId, "stdout", "info", line));
        const streamEvent = codexJsonlToStreamEvent(input.sessionId, line);
        if (streamEvent) {
          input.onStreamEvent?.(streamEvent);
        }
      },
      onStderr: (line) => input.onEvent?.(event(input.sessionId, "stderr", "warn", line)),
      onError: (error) => {
        currentStatus = "failed";
        const session = this.sessions.get(input.sessionId);
        if (session) {
          session.status = currentStatus;
        }
        input.onStatus?.("failed");
        input.onEvent?.(event(input.sessionId, "system", "error", `Codex process error: ${error.message}`));
      },
      onExit: (code, signal) => {
        const session = this.sessions.get(input.sessionId);
        const status: AgentStatus = session?.stopping ? "stopped" : code === 0 ? "completed" : "failed";
        if (session) {
          session.status = status;
        }
        input.onStatus?.(status);
        input.onEvent?.(event(input.sessionId, "system", code === 0 ? "info" : "error", `Codex process exited with code ${code ?? "null"} signal ${signal ?? "null"}`));
      }
    });

    this.sessions.set(input.sessionId, { process: running, status: currentStatus, stopping: false });

    if (input.initialPrompt) {
      running.write(`${input.initialPrompt}\n`);
    }

    return {
      sessionId: input.sessionId,
      status: currentStatus,
      pid: running.child?.pid ?? null
    };
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Codex session is not running: ${sessionId}`);
    }
    session.process.write(`${message}\n`);
  }

  async stop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.status = "stopping";
    session.stopping = true;
    session.process.stop();
  }

  async getStatus(sessionId: string): Promise<AgentStatus> {
    return this.sessions.get(sessionId)?.status ?? "idle";
  }
}

function event(sessionId: string, stream: AgentRuntimeEvent["stream"], level: AgentRuntimeEvent["level"], line: string): AgentRuntimeEvent {
  return {
    sessionId,
    stream,
    level,
    line,
    createdAt: new Date().toISOString()
  };
}

function parseArgs(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  // ponytail: simple whitespace split is enough for MVP; upgrade to shell-quote parsing when quoted args are required.
  return value.trim().split(/\s+/);
}
