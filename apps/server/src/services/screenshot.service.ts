import { createReadStream, statSync } from "node:fs";
import type { Artifact } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";
import { captureScreenshot } from "@aic/runtime";

export class ScreenshotService {
  constructor(
    private readonly repo: ConsoleRepository,
    private readonly artifactRoot: string
  ) {}

  async createScreenshot(sessionId: string, url?: string): Promise<Artifact> {
    const session = this.repo.findSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在：${sessionId}`);
    }
    const targetUrl = validateLocalScreenshotUrl(url);
    const result = await captureScreenshot({
      artifactRoot: this.artifactRoot,
      sessionId,
      url: targetUrl
    });
    const artifact = this.repo.createArtifact({
      sessionId,
      type: "screenshot",
      name: result.name,
      filePath: result.filePath,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes
    });
    this.repo.appendLog({
      sessionId,
      stream: "system",
      level: result.usedPlaceholder ? "warn" : "info",
      line: result.usedPlaceholder
        ? `截图降级产物已保存：${result.targetUrl}，原因：${result.unavailableReason}`
        : `截图已保存：${result.targetUrl}`
    });
    return artifact;
  }

  listScreenshots(sessionId: string): Artifact[] {
    return this.repo.listArtifacts(sessionId, "screenshot");
  }

  getArtifactStream(artifactId: string): { artifact: Artifact; stream: NodeJS.ReadableStream; sizeBytes: number } {
    const artifact = this.repo.findArtifact(artifactId);
    if (!artifact) {
      throw new Error(`产物不存在：${artifactId}`);
    }
    const stat = statSync(artifact.filePath);
    return {
      artifact,
      stream: createReadStream(artifact.filePath),
      sizeBytes: stat.size
    };
  }
}

function validateLocalScreenshotUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("截图 URL 无效：需要本地 http(s) 绝对地址");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !isLocalHost(parsed.hostname)) {
    throw new Error("截图 URL 无效：只允许 localhost、127.0.0.1 或 ::1 目标");
  }
  return parsed.toString();
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "::1" || hostname === "[::1]" || hostname === "127.0.0.1" || hostname.startsWith("127.");
}
