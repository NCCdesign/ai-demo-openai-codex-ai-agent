import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConsoleRepository, openDatabase, runMigrations } from "@aic/db";
import { hashPassword } from "../security/passwords.js";
import { CommandService } from "./command.service.js";
import { CommandWorker } from "./command-worker.js";
import { SessionService } from "./session.service.js";
import { AgentRegistry } from "@aic/agents";

const root = mkdtempSync(join(tmpdir(), "aic-command-worker-check-"));
const db = openDatabase(join(root, "worker.sqlite"));

try {
  runMigrations(db);
  const repo = new ConsoleRepository(db);
  repo.seedDevelopmentData({
    email: "admin@example.local",
    passwordHash: hashPassword("change-me"),
    workspacePath: root
  });
  const sessions = new SessionService(repo, new AgentRegistry());
  const commands = new CommandService(repo);
  const worker = new CommandWorker(repo, sessions);
  const session = await sessions.createSession({
    workspaceId: "wks_default",
    agentId: "agt_noop",
    userId: "usr_admin",
    title: "Worker check"
  });

  const pause = commands.createCommand({ type: "agent.pause", sessionId: session.id, source: "api", userId: "usr_admin" });
  await worker.processQueued();
  assert.equal(repo.findCommand(pause.id)?.status, "completed");
  assert.equal(repo.findSession(session.id)?.status, "waiting_for_user");

  const resume = commands.createCommand({ type: "agent.resume", sessionId: session.id, source: "api", userId: "usr_admin" });
  await worker.processQueued();
  assert.equal(repo.findCommand(resume.id)?.status, "completed");
  assert.equal(repo.findSession(session.id)?.status, "running");

  const stop = commands.createCommand({ type: "agent.stop", sessionId: session.id, source: "api", userId: "usr_admin" });
  await worker.processQueued();
  assert.equal(repo.findCommand(stop.id)?.status, "completed");
  assert.equal(repo.findSession(session.id)?.status, "stopped");

  const screenshot = commands.createCommand({ type: "agent.screenshot", sessionId: session.id, source: "api", userId: "usr_admin" });
  await worker.processQueued();
  assert.equal(repo.findCommand(screenshot.id)?.status, "failed");
  assert.match(repo.findCommand(screenshot.id)?.errorMessage ?? "", /not implemented/);

  console.log("command worker check passed");
} finally {
  db.close();
  rmSync(root, { recursive: true, force: true });
}
