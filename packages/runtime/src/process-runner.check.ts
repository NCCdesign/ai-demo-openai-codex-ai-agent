import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { spawn } from "node:child_process";
import { startProcess } from "./process-runner.js";

let onErrorCalled = false;
const running = startProcess({
  command: "codex",
  cwd: process.cwd(),
  onError: () => {
    onErrorCalled = true;
  },
  spawnProcess: (() => {
    throw new Error("Access is denied");
  }) as unknown as typeof spawn
});

assert.equal(running.child, null);
assert.match(running.startError?.message ?? "", /Access is denied/);
await running.exited;
assert.equal(onErrorCalled, false);
assert.equal(running.stop().ok, false);
assert.equal(running.pause().ok, false);
assert.equal(running.resume().ok, false);

const stdout = new EventEmitter();
const stderr = new EventEmitter();
const child = new EventEmitter() as EventEmitter & {
  stdout: EventEmitter & { setEncoding: (encoding: string) => void };
  stderr: EventEmitter & { setEncoding: (encoding: string) => void };
  stdin: { write: (value: string) => boolean };
  kill: (signal: string) => boolean;
  pid: number;
};
child.stdout = Object.assign(stdout, { setEncoding: () => undefined });
child.stderr = Object.assign(stderr, { setEncoding: () => undefined });
child.stdin = { write: () => true };
child.kill = () => true;
child.pid = 123;

const started = startProcess({
  command: "codex",
  cwd: process.cwd(),
  spawnProcess: (() => child) as unknown as typeof spawn
});

assert.equal(started.child?.pid, 123);
assert.equal(started.startError, null);

const live = startProcess({
  command: process.execPath,
  args: ["-e", "setInterval(() => {}, 1000)"],
  cwd: process.cwd()
});
assert.ok(live.child?.pid);
assert.equal(live.startError, null);
assert.equal(live.pause().ok, true);
assert.equal(live.resume().ok, true);
assert.equal(live.stop().ok, true);
await live.exited;

if (process.platform === "win32") {
  let childPid: number | null = null;
  const tree = startProcess({
    command: process.execPath,
    args: [
      "-e",
      "const { spawn } = require('node:child_process'); const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); console.log(child.pid); setInterval(() => {}, 1000)"
    ],
    cwd: process.cwd(),
    onStdout: (line) => {
      childPid = Number(line);
    }
  });
  const parentPid = tree.child?.pid;
  assert.ok(parentPid);
  assert.equal(tree.startError, null);
  for (let attempt = 0; attempt < 20 && !childPid; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(childPid);
  assert.equal(tree.stop().ok, true);
  await tree.exited;
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(isWindowsProcessRunning(parentPid), false);
  assert.equal(isWindowsProcessRunning(childPid), false);
}

console.log("process runner check passed");

function isWindowsProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
