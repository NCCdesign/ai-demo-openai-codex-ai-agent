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
assert.equal(onErrorCalled, false);
assert.equal(running.pause(), false);
assert.equal(running.resume(), false);

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

console.log("process runner check passed");
