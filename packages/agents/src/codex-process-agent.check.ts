import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexProcessAgentAdapter, resolveDefaultCodexCommand } from "./codex-process-agent.js";
import type { ProcessRunnerInput, startProcess } from "@aic/runtime";

const root = mkdtempSync(join(tmpdir(), "aic-codex-agent-check-"));

try {
  const events: string[] = [];
  const streamEvents: string[] = [];
  const statuses: string[] = [];
  const spawnInputs: Array<{ command: string; args: string[]; closeStdin?: boolean }> = [];
  const adapter = new CodexProcessAgentAdapter({
    command: "codex",
    startProcess: ((input: ProcessRunnerInput) => {
      spawnInputs.push({ command: input.command, args: input.args ?? [], closeStdin: input.closeStdin });
      return {
        child: null,
        startError: new Error("Access is denied"),
        stop: () => undefined,
        pause: () => ({ ok: false }),
        resume: () => ({ ok: false }),
        write: () => undefined
      };
    }) as unknown as typeof startProcess
  });
  const handle = await adapter.start({
    sessionId: "ses_check",
    workspacePath: root,
    onEvent: (event) => events.push(`${event.stream}/${event.level}: ${event.line}`),
    onStreamEvent: (event) => streamEvents.push(`${event.type}: ${String(event.payload.message ?? "")}`),
    onStatus: (status) => statuses.push(status)
  });

  assert.equal(handle.status, "waiting_for_user");
  assert.equal(handle.pid, null);
  assert.deepEqual(statuses, ["waiting_for_user"]);
  await assert.rejects(() => adapter.sendMessage("ses_check", "Continue"), /Access is denied/);
  assert.deepEqual(spawnInputs[0]?.args.slice(0, 2), ["exec", "--json"]);
  assert.equal(spawnInputs[0]?.args.at(-1), "Continue");
  assert.equal(spawnInputs[0]?.closeStdin, true);
  assert.equal(await adapter.getStatus("ses_check"), "failed");
  assert.match(events.join("\n"), /Codex process unavailable/);
  assert.match(streamEvents.join("\n"), /error: Codex process unavailable/);

  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter & { setEncoding: (encoding: string) => void };
    stderr: EventEmitter & { setEncoding: (encoding: string) => void };
    stdin: { write: (value: string) => boolean };
    kill: (signal: string) => boolean;
    pid: number;
  };
  child.stdout = Object.assign(new EventEmitter(), { setEncoding: () => undefined });
  child.stderr = Object.assign(new EventEmitter(), { setEncoding: () => undefined });
  child.stdin = { write: () => true };
  child.kill = () => true;
  child.pid = 234;
  const completedStatuses: string[] = [];
  const completedSpawnInputs: Array<{ args: string[] }> = [];
  const completedAdapter = new CodexProcessAgentAdapter({
    command: "codex",
    startProcess: ((input: ProcessRunnerInput) => {
      completedSpawnInputs.push({ args: input.args ?? [] });
      setImmediate(() => {
        input.onStdout?.(JSON.stringify({ type: "thread.started", thread_id: "thread_check" }));
        input.onStdout?.(JSON.stringify({ type: "turn.completed" }));
        input.onExit?.(0, null);
      });
      return {
        child,
        startError: null,
        stop: () => undefined,
        pause: () => ({ ok: true }),
        resume: () => ({ ok: true }),
        write: () => undefined
      };
    }) as unknown as typeof startProcess
  });
  await completedAdapter.start({
    sessionId: "ses_completed",
    workspacePath: root,
    onStatus: (status) => completedStatuses.push(status)
  });
  await completedAdapter.sendMessage("ses_completed", "Continue");
  assert.equal(await completedAdapter.getStatus("ses_completed"), "running");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await completedAdapter.getStatus("ses_completed"), "completed");
  await completedAdapter.sendMessage("ses_completed", "Continue again");
  assert.deepEqual(completedSpawnInputs[1]?.args, ["exec", "resume", "--json", "--skip-git-repo-check", "thread_check", "Continue again"]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(completedStatuses, ["waiting_for_user", "running", "completed", "running", "completed"]);

  if (process.platform === "win32") {
    assert.doesNotMatch(resolveDefaultCodexCommand(), /\\WindowsApps\\/i);
  }

  console.log("codex process adapter check passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
