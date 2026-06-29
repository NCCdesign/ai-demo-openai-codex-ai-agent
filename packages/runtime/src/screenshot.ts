import { execFile } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

export interface ScreenshotCaptureInput {
  artifactRoot: string;
  sessionId: string;
  url?: string;
  browserCommand?: string;
}

export interface ScreenshotCaptureResult {
  name: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  targetUrl: string;
  usedPlaceholder: boolean;
  unavailableReason?: string;
}

const placeholderPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP88ePHfwAJqgP5v8asJwAAAABJRU5ErkJggg==",
  "base64"
);

const execFileAsync = promisify(execFile);

export async function captureScreenshot(input: ScreenshotCaptureInput): Promise<ScreenshotCaptureResult> {
  const directory = join(input.artifactRoot, "screenshots", input.sessionId);
  mkdirSync(directory, { recursive: true });
  const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.png`;
  const filePath = join(directory, name);
  const targetUrl = input.url ?? "http://127.0.0.1:3000";
  const browser = input.browserCommand ?? findBrowserExecutable();

  if (!browser) {
    return writePlaceholder(filePath, name, targetUrl, "未找到可用的浏览器可执行文件。");
  }

  const profileDirectory = join(tmpdir(), `aic-browser-${randomUUID()}`);
  mkdirSync(profileDirectory, { recursive: true });
  try {
    await execFileAsync(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-dev-shm-usage",
        `--user-data-dir=${profileDirectory}`,
        "--window-size=390,844",
        `--screenshot=${filePath}`,
        targetUrl
      ],
      {
        timeout: 30_000,
        windowsHide: true
      }
    );
    if (!existsSync(filePath)) {
      return writePlaceholder(filePath, name, targetUrl, "浏览器命令结束但没有生成截图文件。");
    }
    const stat = statSync(filePath);
    if (stat.size <= placeholderPng.byteLength) {
      return writePlaceholder(filePath, name, targetUrl, `浏览器命令生成了空截图或无效截图文件（${stat.size} 字节）。`);
    }
    return {
      name,
      filePath,
      mimeType: "image/png",
      sizeBytes: stat.size,
      targetUrl,
      usedPlaceholder: false
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return writePlaceholder(filePath, name, targetUrl, `浏览器截图失败：${reason}`);
  } finally {
    rmSync(profileDirectory, { recursive: true, force: true });
  }
}

function writePlaceholder(filePath: string, name: string, targetUrl: string, unavailableReason: string): ScreenshotCaptureResult {
  // ponytail: fallback keeps the artifact pipeline testable; replace with Playwright only when Chromium discovery is not enough.
  writeFileSync(filePath, placeholderPng);

  return {
    name,
    filePath,
    mimeType: "image/png",
    sizeBytes: placeholderPng.byteLength,
    targetUrl,
    usedPlaceholder: true,
    unavailableReason
  };
}

function findBrowserExecutable(): string | null {
  const candidates = [
    process.env.AIC_BROWSER_COMMAND,
    process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : undefined,
    process.platform === "win32" ? "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" : undefined,
    process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined,
    process.platform === "win32" ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" : undefined,
    "google-chrome",
    "chromium",
    "chromium-browser",
    "msedge"
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate.includes("\\") || candidate.includes("/")) {
      if (existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    return candidate;
  }

  return null;
}
