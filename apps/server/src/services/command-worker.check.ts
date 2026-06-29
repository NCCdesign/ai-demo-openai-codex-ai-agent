import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConsoleRepository, openDatabase, runMigrations } from "@aic/db";
import type { AgentAdapter, AgentSessionHandle, StartAgentInput } from "@aic/core";
import { hashPassword } from "../security/passwords.js";
import { CommandService } from "./command.service.js";
import { CommandWorker } from "./command-worker.js";
import { SessionService } from "./session.service.js";
import { AgentRegistry } from "@aic/agents";

class ControlRecordingAgentAdapter implements AgentAdapter {
  readonly type = "noop";
  readonly calls: string[] = [];

  async start(input: StartAgentInput): Promise<AgentSessionHandle> {
    this.calls.push("start");
    return { sessionId: input.sessionId, status: "waiting_for_user" };
  }

  async sendMessage(): Promise<void> {
    this.calls.push("sendMessage");
  }

  async pause(): Promise<void> {
    this.calls.push("pause");
  }

  async resume(): Promise<void> {
    this.calls.push("resume");
  }

  async stop(): Promise<void> {
    this.calls.push("stop");
  }

  async getStatus(): Promise<AgentSessionHandle["status"]> {
    return "running";
  }
}

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
  const adapter = new ControlRecordingAgentAdapter();
  const sessions = new SessionService(repo, new AgentRegistry([adapter]));
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
  const completedPause = repo.findCommand(pause.id);
  assert.equal(completedPause?.status, "completed");
  assert.ok(completedPause?.startedAt);
  assert.ok(completedPause?.completedAt);
  assert.notEqual(completedPause?.durationMs, null);
  assert.equal(repo.findSession(session.id)?.status, "waiting_for_user");
  assert.deepEqual(adapter.calls, ["start", "pause"]);

  const resume = commands.createCommand({ type: "agent.resume", sessionId: session.id, source: "api", userId: "usr_admin" });
  await worker.processQueued();
  assert.equal(repo.findCommand(resume.id)?.status, "completed");
  assert.equal(repo.findSession(session.id)?.status, "running");
  assert.deepEqual(adapter.calls, ["start", "pause", "resume"]);

  const stop = commands.createCommand({ type: "agent.stop", sessionId: session.id, source: "api", userId: "usr_admin" });
  await worker.processQueued();
  assert.equal(repo.findCommand(stop.id)?.status, "completed");
  assert.equal(repo.findSession(session.id)?.status, "stopped");
  assert.deepEqual(adapter.calls, ["start", "pause", "resume", "stop"]);

  const screenshot = commands.createCommand({ type: "agent.screenshot", sessionId: session.id, source: "api", userId: "usr_admin" });
  await worker.processQueued();
  assert.equal(repo.findCommand(screenshot.id)?.status, "failed");
  assert.match(repo.findCommand(screenshot.id)?.errorMessage ?? "", /not implemented/);
  assert.equal(repo.findCommand(screenshot.id)?.exitCode, 1);

  console.log("command worker check passed");
} finally {
  db.close();
  rmSync(root, { recursive: true, force: true });
}
