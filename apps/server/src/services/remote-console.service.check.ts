import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConsoleRepository, openDatabase, runMigrations } from "@aic/db";
import { hashPassword } from "../security/passwords.js";
import { AgentRuntimeService } from "./agent-runtime.service.js";
import { CommandService } from "./command.service.js";
import { RemoteConsoleService } from "./remote-console.service.js";

const root = mkdtempSync(join(tmpdir(), "aic-remote-console-check-"));
const db = openDatabase(join(root, "remote-console.sqlite"));

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
    title: "Remote console check",
    status: "running"
  });
  const runtimes = new AgentRuntimeService(repo);
  runtimes.createForSession({
    sessionId: session.id,
    workspaceId: session.workspaceId,
    agentId: session.agentId,
    sessionStatus: "running"
  });
  repo.appendLog({ sessionId: session.id, stream: "agent", level: "info", line: "Planning next step" });
  const createdCommands: string[] = [];
  const remote = new RemoteConsoleService(repo, runtimes, new CommandService(repo), (command) => createdCommands.push(command.id));

  assert.match(remote.getStatusText(), /状态: running/);
  assert.match(remote.getStatusText(), /Planning next step/);
  assert.match(remote.getRecentLogsText({ limit: 1 }), /Planning next step/);

  const result = remote.createControlCommand({ type: "agent.pause", text: "Pause" });
  assert.equal(result.command.source, "telegram");
  assert.equal(result.command.status, "queued");
  assert.equal(result.command.payload.text, "Pause");
  assert.deepEqual(createdCommands, [result.command.id]);

  console.log("remote console service check passed");
} finally {
  db.close();
  rmSync(root, { recursive: true, force: true });
}
