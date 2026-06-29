import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { getGitFileChanges } from "./git.js";

const dir = mkdtempSync(join(tmpdir(), "aic-git-check-"));

try {
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "check@example.local"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Check"], { cwd: dir });
  execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: dir });
  writeFileSync(join(dir, "tracked.txt"), "one\n");
  execFileSync("git", ["add", "tracked.txt"], { cwd: dir });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: dir, stdio: "ignore" });

  writeFileSync(join(dir, "tracked.txt"), "one\ntwo\n");
  writeFileSync(join(dir, "added.txt"), "new\n");

  const changes = await getGitFileChanges(dir);
  if (process.env.AIC_DEBUG_GIT_CHECK) {
    console.log(JSON.stringify(changes, null, 2));
  }
  assert.equal(changes.some((change) => change.path === "tracked.txt" && change.changeType === "modified" && Boolean(change.diff)), true);
  assert.equal(changes.some((change) => change.path === "added.txt" && change.changeType === "added"), true);
  console.log("git file changes check passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
