import type { Command } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";
import type { SessionService } from "./session.service.js";

export class CommandWorker {
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repo: ConsoleRepository,
    private readonly sessions: SessionService,
    private readonly onCommandStatus?: (command: Command) => void
  ) {}

  start(intervalMs = 500): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.processQueued();
    }, intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  wake(): void {
    void this.processQueued();
  }

  async processQueued(limit = 10): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      for (let index = 0; index < limit; index += 1) {
        const command = this.repo.findNextQueuedCommand();
        if (!command) {
          return;
        }
        await this.execute(command);
      }
    } finally {
      this.running = false;
    }
  }

  private async execute(command: Command): Promise<void> {
    let runningCommand = this.repo.updateCommandStatus(command.id, "running");
    this.onCommandStatus?.(runningCommand);
    try {
      const result = await this.executeAgentCommand(runningCommand);
      runningCommand = this.repo.updateCommandStatus(command.id, "completed", { result });
      this.onCommandStatus?.(runningCommand);
    } catch (error) {
      runningCommand = this.repo.updateCommandStatus(command.id, "failed", {
        errorCode: "command_execution_failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        exitCode: 1
      });
      this.onCommandStatus?.(runningCommand);
    }
  }

  private async executeAgentCommand(command: Command): Promise<Record<string, unknown>> {
    if (command.type === "agent.continue") {
      await this.sessions.sendAgentControl(command.sessionId, commandText(command, "Continue"), "running");
      return { delivered: true };
    }
    if (command.type === "agent.pause") {
      await this.sessions.pauseSession(command.sessionId);
      return { delivered: true };
    }
    if (command.type === "agent.resume") {
      await this.sessions.resumeSession(command.sessionId);
      return { delivered: true };
    }
    if (command.type === "agent.stop" || command.type === "agent.cancel") {
      await this.sessions.stopSession(command.sessionId);
      return { delivered: true };
    }
    throw new Error(`Command handler is not implemented yet: ${command.type}`);
  }
}

function commandText(command: Command, fallback: string): string {
  const value = command.payload.text;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
