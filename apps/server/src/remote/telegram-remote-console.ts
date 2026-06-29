import { describeAgentStreamEvent, type AgentRuntimeInstance, type AgentStreamEvent, type Command, type LogLine } from "@aic/core";
import type { RemoteConsoleService } from "../services/remote-console.service.js";

export interface TelegramRemoteConsoleConfig {
  botToken: string | null;
  allowedChatIds: string[];
  pollIntervalMs: number;
  requestTimeoutSeconds: number;
}

export interface TelegramClient {
  getUpdates(input: { offset: number; timeoutSeconds: number }): Promise<TelegramUpdate[]>;
  sendMessage(input: { chatId: string; text: string }): Promise<void>;
}

export interface TelegramUpdate {
  updateId: number;
  message?: {
    chat: {
      id: number | string;
    };
    text?: string;
  };
}

export class TelegramRemoteConsole {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private nextOffset = 0;

  constructor(
    private readonly config: TelegramRemoteConsoleConfig,
    private readonly remote: RemoteConsoleService,
    private readonly client: TelegramClient = config.botToken ? new FetchTelegramClient(config.botToken) : new DisabledTelegramClient()
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.botToken && this.config.allowedChatIds.length);
  }

  start(): void {
    if (!this.enabled || this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, this.config.pollIntervalMs);
    this.timer.unref();
    void this.pollOnce();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  async pollOnce(): Promise<void> {
    if (!this.enabled || this.running) {
      return;
    }
    this.running = true;
    try {
      const updates = await this.client.getUpdates({
        offset: this.nextOffset,
        timeoutSeconds: this.config.requestTimeoutSeconds
      });
      for (const update of updates) {
        this.nextOffset = Math.max(this.nextOffset, update.updateId + 1);
        await this.handleUpdate(update);
      }
    } finally {
      this.running = false;
    }
  }

  async notifyRuntimeStatus(runtime: AgentRuntimeInstance): Promise<void> {
    await this.broadcast([
      "Agent Runtime 状态更新",
      `Session: ${runtime.sessionId}`,
      `状态: ${runtime.status}`,
      `Heartbeat: ${runtime.heartbeatAt}`
    ].join("\n"));
  }

  async notifyCommandStatus(command: Command): Promise<void> {
    await this.broadcast(
      [
        "Command 状态更新",
        `Command: ${command.id}`,
        `类型: ${command.type}`,
        `状态: ${command.status}`,
        `Session: ${command.sessionId}`,
        command.errorMessage ? `错误: ${command.errorMessage}` : null
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n")
    );
  }

  async notifyLogLine(log: LogLine): Promise<void> {
    await this.broadcast(`Log ${log.sessionId}\n[${log.id}] ${log.stream}${log.level ? `/${log.level}` : ""}: ${log.line}`);
  }

  async notifyStreamEvent(event: AgentStreamEvent): Promise<void> {
    await this.broadcast(`Stream ${event.sessionId}\n#${event.sequence} ${event.type}: ${describeAgentStreamEvent(event.type, event.payload)}`);
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const chatId = update.message?.chat.id === undefined ? null : String(update.message.chat.id);
    if (!chatId) {
      return;
    }
    if (!this.config.allowedChatIds.includes(chatId)) {
      await this.client.sendMessage({ chatId, text: "未授权的 Telegram chat。" });
      return;
    }
    const text = update.message?.text?.trim();
    if (!text) {
      return;
    }
    await this.client.sendMessage({ chatId, text: this.handleText(text) });
  }

  private handleText(text: string): string {
    const [command, ...rest] = text.split(/\s+/);
    const body = rest.join(" ").trim();
    switch (normalizeCommand(command ?? "")) {
      case "/status":
        return this.remote.getStatusText(body || undefined);
      case "/logs":
        return this.remote.getRecentLogsText({ sessionId: body || undefined, limit: 20 });
      case "/continue":
        return this.remote.createControlCommand({ type: "agent.continue", text: body || "Continue" }).message;
      case "/pause":
        return this.remote.createControlCommand({ type: "agent.pause", text: body || "Pause" }).message;
      case "/resume":
        return this.remote.createControlCommand({ type: "agent.resume", text: body || "Resume" }).message;
      case "/stop":
        return this.remote.createControlCommand({ type: "agent.stop" }).message;
      case "/help":
        return helpText();
      default:
        return helpText();
    }
  }

  private async broadcast(text: string): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await Promise.all(this.config.allowedChatIds.map((chatId) => this.client.sendMessage({ chatId, text })));
  }
}

class FetchTelegramClient implements TelegramClient {
  constructor(private readonly botToken: string) {}

  async getUpdates(input: { offset: number; timeoutSeconds: number }): Promise<TelegramUpdate[]> {
    const response = await fetch(this.url("getUpdates"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        offset: input.offset,
        timeout: input.timeoutSeconds,
        allowed_updates: ["message"]
      })
    });
    const data = (await response.json()) as { ok?: boolean; result?: TelegramUpdate[]; description?: string };
    if (!response.ok || !data.ok) {
      throw new Error(`Telegram getUpdates failed: ${data.description ?? response.statusText}`);
    }
    return data.result ?? [];
  }

  async sendMessage(input: { chatId: string; text: string }): Promise<void> {
    const response = await fetch(this.url("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text.slice(0, 3900)
      })
    });
    const data = (await response.json()) as { ok?: boolean; description?: string };
    if (!response.ok || !data.ok) {
      throw new Error(`Telegram sendMessage failed: ${data.description ?? response.statusText}`);
    }
  }

  private url(method: string): string {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }
}

class DisabledTelegramClient implements TelegramClient {
  async getUpdates(): Promise<TelegramUpdate[]> {
    return [];
  }

  async sendMessage(): Promise<void> {
    return undefined;
  }
}

function normalizeCommand(command: string): string {
  const [name] = command.toLowerCase().split("@");
  return name ?? "";
}

function helpText(): string {
  return [
    "NCC AI OS Telegram Remote Console",
    "/status [sessionId]",
    "/logs [sessionId]",
    "/continue [text]",
    "/pause",
    "/resume",
    "/stop"
  ].join("\n");
}

export function commandTypeForTelegramText(text: string): Command["type"] | null {
  switch (normalizeCommand(text.trim().split(/\s+/)[0] ?? "")) {
    case "/continue":
      return "agent.continue";
    case "/pause":
      return "agent.pause";
    case "/resume":
      return "agent.resume";
    case "/stop":
      return "agent.stop";
    default:
      return null;
  }
}
