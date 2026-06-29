import assert from "node:assert/strict";
import { codexJsonlToStreamEvent } from "./codex-jsonl-stream.js";

assert.equal(codexJsonlToStreamEvent("ses_1", "not json"), null);

const message = codexJsonlToStreamEvent("ses_1", JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "hello" } }));
assert.equal(message?.type, "token");
assert.equal(message?.payload.text, "hello");

const command = codexJsonlToStreamEvent("ses_1", JSON.stringify({ type: "item.started", item: { type: "command_execution", command: "git status" } }));
assert.equal(command?.type, "tool_call");
assert.equal(command?.payload.name, "git status");

const fileChange = codexJsonlToStreamEvent("ses_1", JSON.stringify({ type: "item.completed", item: { type: "file_change", path: "README.md" } }));
assert.equal(fileChange?.type, "tool_result");
assert.equal(fileChange?.payload.name, "README.md");

const turn = codexJsonlToStreamEvent("ses_1", JSON.stringify({ type: "turn.failed", message: "bad" }));
assert.equal(turn?.type, "status_change");
assert.equal(turn?.payload.status, "failed");

console.log("codex jsonl stream check passed");
