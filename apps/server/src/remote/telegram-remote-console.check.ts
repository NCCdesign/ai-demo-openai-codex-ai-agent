import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConsoleRepository, openDatabase, runMigrations } from "@aic/db";
import { hashPassword } from "../security/passwords.js";
import { AgentRuntimeService } from "../services/agent-runtime.service.js";
import { CommandService } from "../services/command.service.js";
import { RemoteConsoleService } from "../services/remote-console.service.js";
import { commandTypeForTelegramText, TelegramRemoteConsole, type TelegramClient, type TelegramUpdate } from "./telegram-remote-console.js";

class FakeTelegramClient implements TelegramClient {
  sent: Array<{ chatId: string; text: string }> = [];

  constructor(private readonly updates: TelegramUpdate[]) {}

  async getUpdates(): Promise<TelegramUpdate[]> {
    return this.updates.splice(0);
  }

  async sendMessage(input: { chatId: string; text: string }): Promise<void> {
    this.sent.push(input);
  }
}

const root = mkdtempSync(join(tmpdir(), "aic-telegram-check-"));
const db = openDatabase(join(root, "telegram.sqlite"));

try {
  runMigrations(db);
  const repo = new ConsoleRepository(db);
  repo.seedDevelopmentData({
    email: "admin@example.local",
    passwordHash: hashPassword("change-me"),
    workspacePath: root
  });
  const session = repo.createSession({
    workspaceId: "wks_default",
    agentId: "agt_noop",
    createdBy: "usr_admin",
    title: "Telegram check",
    status: "running"
  });
  const runtimes = new AgentRuntimeService(repo);
  runtimes.createForSession({
    sessionId: session.id,
    workspaceId: session.workspaceId,
    agentId: session.agentId,
    sessionStatus: "running"
  });
  repo.appendLog({ sessionId: session.id, stream: "agent", level: "info", line: "Tool call: git status" });
  const createdCommands: string[] = [];
  const remote = new RemoteConsoleService(repo, runtimes, new CommandService(repo), (command) => createdCommands.push(command.id));
  const client = new FakeTelegramClient([
    { updateId: 1, message: { chat: { id: 999 }, text: "/status" } },
    { updateId: 2, message: { chat: { id: 123 }, text: "/status" } },
    { updateId: 3, message: { chat: { id: 123 }, text: "/logs" } },
    { updateId: 4, message: { chat: { id: 123 }, text: "/pause" } }
  ]);
  const telegram = new TelegramRemoteConsole(
    {
      botToken: "test-token",
      allowedChatIds: ["123"],
      pollIntervalMs: 1000,
      requestTimeoutSeconds: 1
    },
    remote,
    client
  );

  assert.equal(telegram.enabled, true);
  await telegram.pollOnce();
  assert.match(client.sent[0]?.text ?? "", /未授权/);
  assert.match(client.sent[1]?.text ?? "", /状态: running/);
  assert.match(client.sent[2]?.text ?? "", /Tool call: git status/);
  assert.match(client.sent[3]?.text ?? "", /已入队: agent.pause/);
  assert.equal(repo.findCommand(createdCommands[0] ?? "")?.source, "telegram");
  assert.equal(commandTypeForTelegramText("/continue hello"), "agent.continue");
  assert.equal(commandTypeForTelegramText("/unknown"), null);

  const disabled = new TelegramRemoteConsole(
    { botToken: null, allowedChatIds: ["123"], pollIntervalMs: 1000, requestTimeoutSeconds: 1 },
    remote,
    client
  );
  assert.equal(disabled.enabled, false);

  console.log("telegram remote console check passed");
} finally {
  db.close();
  rmSync(root, { recursive: true, force: true });
}
