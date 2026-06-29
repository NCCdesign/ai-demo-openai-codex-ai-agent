import assert from "node:assert/strict";
import { canTransitionSession, transitionSession } from "./session-state-machine.js";

assert.equal(canTransitionSession("idle", "starting"), true);
assert.equal(canTransitionSession("running", "waiting_for_user"), true);
assert.equal(canTransitionSession("completed", "running"), false);

assert.equal(transitionSession("waiting_for_user", "running"), "running");
assert.throws(() => transitionSession("completed", "running"), /Invalid session transition/);

console.log("session state-machine check passed");

