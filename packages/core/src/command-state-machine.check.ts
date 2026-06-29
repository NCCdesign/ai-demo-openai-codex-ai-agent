import assert from "node:assert/strict";
import { canTransitionCommand, getAllowedCommandTransitions, isCommandSource, isCommandType, transitionCommand } from "./command-state-machine.js";

assert.equal(canTransitionCommand("queued", "running"), true);
assert.equal(canTransitionCommand("running", "completed"), true);
assert.equal(canTransitionCommand("waiting_for_user", "running"), true);
assert.equal(canTransitionCommand("failed", "queued"), true);
assert.equal(canTransitionCommand("completed", "running"), false);
assert.equal(canTransitionCommand("cancelled", "queued"), false);

assert.equal(transitionCommand("queued", "waiting_for_user"), "waiting_for_user");
assert.deepEqual(getAllowedCommandTransitions("completed"), []);
assert.equal(isCommandType("agent.continue"), true);
assert.equal(isCommandType("agent.fly"), false);
assert.equal(isCommandSource("telegram"), true);
assert.equal(isCommandSource("email"), false);
assert.throws(() => transitionCommand("completed", "running"), /Invalid command transition/);

console.log("command state-machine check passed");
