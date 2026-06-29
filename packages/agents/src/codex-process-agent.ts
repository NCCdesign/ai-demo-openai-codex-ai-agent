import type { AgentAdapter, AgentRuntimeEvent, AgentStatus, AgentStreamEventDraft, StartAgentInput } from "@aic/core";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { startProcess, type RunningProcess } from "@aic/runtime";
import { codexJsonlToStreamEvent } from "./codex-jsonl-stream.js";

export interface CodexProcessAgentOptions {
  command?: string;
  args?: string[];
  startProcess?: typeof startProcess;
}

interface CodexProcessSession {
  process: RunningProcess | null;
  status: AgentStatus;
  stopping: boolean;
  workspacePath: string;
  command: string;
  args: string[];
  lastPrompt: string | null;
  threadId: string | null;
  onEvent?: StartAgentInput["onEvent"];
  onStreamEvent?: StartAgentInput["onStreamEvent"];
  onStatus?: StartAgentInput["onStatus"];
}

type RunningCodexProcessSession = CodexProcessSession & { process: RunningProcess };

export class CodexProcessAgentAdapter implements AgentAdapter {
  readonly type = "codex";
  private readonly sessions = new Map<string, CodexProcessSession>();

  constructor(private readonly options: CodexProcessAgentOptions = {}) {}

  async start(input: StartAgentInput) {
    const command = this.options.command ?? nonEmpty(process.env.AIC_CODEX_COMMAND) ?? resolveDefaultCodexCommand();
    const args = this.options.args ?? defaultCodexArgs();
    this.sessions.set(input.sessionId, {
      process: null,
      status: "waiting_for_user",
      stopping: false,
      workspacePath: input.workspacePath,
      command,
      args,
      lastPrompt: input.initialPrompt ?? null,
      threadId: null,
      onEvent: input.onEvent,
      onStreamEvent: input.onStreamEvent,
      onStatus: input.onStatus
    });
    const status: AgentStatus = "waiting_for_user";
    input.onStatus?.(status);

    if (input.initialPrompt) {
      await this.sendMessage(input.sessionId, input.initialPrompt);
      const status = await this.getStatus(input.sessionId);
      return {
        sessionId: input.sessionId,
        status,
        pid: this.sessions.get(input.sessionId)?.process?.child?.pid ?? null
      };
    }

    return {
      sessionId: input.sessionId,
      status,
      pid: null
    };
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.requireSession(sessionId);
    if (session.process?.child && ["starting", "running", "stopping"].includes(session.status)) {
      throw new Error(`Codex session is already running: ${sessionId}`);
    }

    session.stopping = false;
    session.lastPrompt = message;
    session.status = "running";
    const running = (this.options.startProcess ?? startProcess)({
      command: session.command,
      args: codexRunArgs(session, message),
      cwd: session.workspacePath,
      closeStdin: true,
      onStdout: (line) => {
        this.emitEvent(sessionId, "stdout", "info", line);
        const threadId = codexThreadId(line);
        if (threadId) {
          session.threadId = threadId;
        }
        const streamEvent = codexJsonlToStreamEvent(sessionId, line);
        if (streamEvent) {
          this.emitStreamEvent(sessionId, streamEvent);
        }
      },
      onStderr: (line) => this.emitEvent(sessionId, "stderr", "warn", line),
      onError: (error) => {
        const current = this.sessions.get(sessionId);
        if (current?.process === running) {
          current.status = "failed";
          this.emitStatus(sessionId, "failed", { pid: null });
          this.emitEvent(sessionId, "system", "error", `Codex process error: ${error.message}`);
        }
      },
      onExit: (code, signal) => {
        const current = this.sessions.get(sessionId);
        if (current?.process !== running) {
          return;
        }
        const status: AgentStatus = current.stopping ? "stopped" : code === 0 ? "completed" : "failed";
        current.status = status;
        current.process = null;
        this.emitStatus(sessionId, status, { pid: null });
        this.emitEvent(sessionId, "system", code === 0 ? "info" : "error", `Codex process exited with code ${code ?? "null"} signal ${signal ?? "null"}`);
      }
    });

    if (!running.child) {
      const message = running.startError?.message ?? "Codex process did not start.";
      session.status = "failed";
      session.process = null;
      this.emitStatus(sessionId, "failed", { pid: null });
      this.emitEvent(sessionId, "system", "error", `Codex process unavailable: ${message}`);
      this.emitStreamEvent(sessionId, {
        sessionId,
        type: "error",
        payload: {
          message: `Codex process unavailable: ${message}`,
          source: "codex_process",
          command: session.command,
          args: session.args
        }
      });
      throw new Error(`Codex process unavailable: ${message}`);
    }

    session.process = running;
    this.emitStatus(sessionId, "running", { pid: running.child.pid ?? null });
  }

  async pause(sessionId: string): Promise<void> {
    const session = this.requireRunningSession(sessionId);
    const paused = session.process.pause();
    if (!paused.ok) {
      throw new Error(paused.error ?? "Codex process pause is not supported on this platform yet.");
    }
    session.status = "waiting_for_user";
  }

  async resume(sessionId: string): Promise<void> {
    const session = this.requireRunningSession(sessionId);
    const resumed = session.process.resume();
    if (!resumed.ok) {
      throw new Error(resumed.error ?? "Codex process resume is not supported on this platform yet.");
    }
    session.status = "running";
  }

  async stop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session?.process) {
      return;
    }
    const process = session.process;
    session.status = "stopping";
    session.stopping = true;
    const stopped = process.stop();
    if (!stopped.ok) {
      session.status = "running";
      session.stopping = false;
      throw new Error(stopped.error ?? "Codex process stop failed.");
    }
    await process.exited;
  }

  async getStatus(sessionId: string): Promise<AgentStatus> {
    return this.sessions.get(sessionId)?.status ?? "idle";
  }

  private requireSession(sessionId: string): CodexProcessSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Codex session is not running: ${sessionId}`);
    }
    return session;
  }

  private requireRunningSession(sessionId: string): RunningCodexProcessSession {
    const session = this.requireSession(sessionId);
    if (!session.process) {
      throw new Error(`Codex session is not running: ${sessionId}`);
    }
    return session as RunningCodexProcessSession;
  }

  private emitStatus(sessionId: string, status: AgentStatus, metadata: { pid?: number | null; lastError?: string | null } = {}): void {
    this.sessions.get(sessionId)?.onStatus?.(status, metadata);
  }

  private emitEvent(sessionId: string, stream: AgentRuntimeEvent["stream"], level: AgentRuntimeEvent["level"], line: string): void {
    this.sessions.get(sessionId)?.onEvent?.(event(sessionId, stream, level, line));
  }

  private emitStreamEvent(sessionId: string, streamEvent: AgentStreamEventDraft): void {
    this.sessions.get(sessionId)?.onStreamEvent?.(streamEvent);
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

function defaultCodexArgs(): string[] {
  const configured = parseArgs(process.env.AIC_CODEX_ARGS);
  if (configured.length) {
    return configured;
  }
  return ["exec", "--json", "--skip-git-repo-check", "--sandbox", "workspace-write"];
}

function codexRunArgs(session: Pick<CodexProcessSession, "args" | "threadId">, message: string): string[] {
  if (!session.threadId) {
    return [...session.args, message];
  }
  return ["exec", "resume", "--json", "--skip-git-repo-check", session.threadId, message];
}

function codexThreadId(line: string): string | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    return record.type === "thread.started" && typeof record.thread_id === "string" && record.thread_id.trim() ? record.thread_id.trim() : null;
  } catch {
    return null;
  }
}

function nonEmpty(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

export function resolveDefaultCodexCommand(): string {
  if (process.platform !== "win32") {
    return "codex";
  }

  const candidates = [
    process.env.APPDATA ? join(process.env.APPDATA, "npm", "codex.cmd") : null,
    join(homedir(), ".codex", ".sandbox-bin", "codex.exe"),
    join(homedir(), ".codex", "plugins", ".plugin-appserver", "codex.exe")
  ].filter((candidate): candidate is string => Boolean(candidate));

  const match = candidates.find((candidate) => existsSync(candidate));
  // ponytail: prefer a user-writable Codex CLI shim on Windows because WindowsApps package resources can appear in PATH but fail with Access denied; explicit AIC_CODEX_COMMAND remains the upgrade path.
  return match ?? "codex";
}
