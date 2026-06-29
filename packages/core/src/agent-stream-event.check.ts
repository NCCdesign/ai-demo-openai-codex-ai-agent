import assert from "node:assert/strict";
import { describeAgentStreamEvent, isAgentStreamEventType } from "./agent-stream-event.js";

assert.equal(isAgentStreamEventType("token"), true);
assert.equal(isAgentStreamEventType("tool_call"), true);
assert.equal(isAgentStreamEventType("unknown"), false);
assert.equal(describeAgentStreamEvent("token", { text: "hello" }), "hello");
assert.equal(describeAgentStreamEvent("tool_call", { name: "git status" }), "Tool call: git status");
assert.equal(describeAgentStreamEvent("status_change", { status: "running" }), "Status: running");

console.log("agent stream event check passed");
