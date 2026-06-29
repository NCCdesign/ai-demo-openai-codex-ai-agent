import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexProcessAgentAdapter } from "./codex-process-agent.js";
import type { startProcess } from "@aic/runtime";

const root = mkdtempSync(join(tmpdir(), "aic-codex-agent-check-"));

try {
  const events: string[] = [];
  const streamEvents: string[] = [];
  const statuses: string[] = [];
  const adapter = new CodexProcessAgentAdapter({
    command: "codex",
    startProcess: (() => ({
      child: null,
      startError: new Error("Access is denied"),
      stop: () => undefined,
      pause: () => false,
      resume: () => false,
      write: () => undefined
    })) as typeof startProcess
  });
  const handle = await adapter.start({
    sessionId: "ses_check",
    workspacePath: root,
    onEvent: (event) => events.push(`${event.stream}/${event.level}: ${event.line}`),
    onStreamEvent: (event) => streamEvents.push(`${event.type}: ${String(event.payload.message ?? "")}`),
    onStatus: (status) => statuses.push(status)
  });

  assert.equal(handle.status, "failed");
  assert.equal(handle.pid, null);
  assert.match(handle.lastError ?? "", /Access is denied/);
  assert.deepEqual(statuses, ["failed"]);
  assert.match(events.join("\n"), /Codex process unavailable/);
  assert.match(streamEvents.join("\n"), /error: Codex process unavailable/);
  assert.equal(await adapter.getStatus("ses_check"), "idle");

  console.log("codex process adapter check passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
