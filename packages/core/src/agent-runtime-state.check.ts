import assert from "node:assert/strict";
import { isAgentRuntimeStatus, mapSessionStatusToRuntimeStatus } from "./agent-runtime-state.js";

assert.equal(mapSessionStatusToRuntimeStatus("idle"), "idle");
assert.equal(mapSessionStatusToRuntimeStatus("starting"), "planning");
assert.equal(mapSessionStatusToRuntimeStatus("running"), "running");
assert.equal(mapSessionStatusToRuntimeStatus("waiting_for_user"), "waiting");
assert.equal(mapSessionStatusToRuntimeStatus("stopped"), "cancelled");
assert.equal(mapSessionStatusToRuntimeStatus("failed"), "failed");
assert.equal(mapSessionStatusToRuntimeStatus("completed"), "completed");
assert.equal(isAgentRuntimeStatus("tool_calling"), true);
assert.equal(isAgentRuntimeStatus("waiting_for_user"), false);

console.log("agent runtime state check passed");
