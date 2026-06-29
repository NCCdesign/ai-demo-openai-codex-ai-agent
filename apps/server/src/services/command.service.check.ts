import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { ConsoleRepository, openDatabase, runMigrations } from "@aic/db";
import { hashPassword } from "../security/passwords.js";
import { CommandService } from "./command.service.js";

const root = mkdtempSync(join(tmpdir(), "aic-command-check-"));
const db = openDatabase(join(root, "commands.sqlite"));

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
    status: "waiting_for_user"
  });
  const service = new CommandService(repo);
  const command = service.createCommand({
    type: "agent.continue",
    sessionId: session.id,
    source: "api",
    userId: "usr_admin",
    payload: { text: "Continue" }
  });

  assert.equal(command.status, "queued");
  assert.equal(command.workspaceId, "wks_default");
  assert.equal(command.agentId, "agt_noop");
  assert.match(command.taskId ?? "", /^tsk_/);
  assert.equal(command.commandText, "Continue");
  assert.equal(command.toolName, "agent");
  assert.equal(command.exitCode, null);
  assert.equal(command.durationMs, null);
  assert.equal(command.payload.text, "Continue");
  assert.equal(service.getCommand(command.id)?.id, command.id);
  assert.equal(service.listCommands({ sessionId: session.id })[0]?.id, command.id);

  console.log("command service check passed");
} finally {
  db.close();
  rmSync(root, { recursive: true, force: true });
}
