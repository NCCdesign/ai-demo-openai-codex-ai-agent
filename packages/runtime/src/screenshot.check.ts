import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureScreenshot } from "./screenshot.js";

const root = mkdtempSync(join(tmpdir(), "aic-screenshot-check-"));

try {
  const result = await captureScreenshot({
    artifactRoot: root,
    sessionId: "ses_check",
    url: "http://127.0.0.1:9",
    browserCommand: join(root, "missing-browser")
  });

  if (!result.usedPlaceholder) {
    throw new Error("Expected missing browser to use placeholder fallback");
  }
  if (result.mimeType !== "image/png") {
    throw new Error(`Expected image/png, got ${result.mimeType}`);
  }
  const bytes = readFileSync(result.filePath);
  if (bytes.length !== result.sizeBytes || bytes.length === 0) {
    throw new Error("Screenshot artifact size is inconsistent");
  }

  console.log("screenshot fallback check passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
