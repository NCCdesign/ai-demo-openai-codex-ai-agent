"use client";

import type { Artifact, SessionListItem } from "@aic/core";
import { Camera, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { LoginPanel } from "../../components/login-panel";
import { createScreenshot, getArtifactBlobUrl, getSession, listScreenshots, listSessions, loadSavedOrLatestSession, login } from "../../lib/api-client";
import { sessionTitleLabel } from "../../lib/display";

const tokenKey = "aic.token";
const sessionKey = "aic.sessionId";

export default function ScreenshotsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(tokenKey);
    const savedSessionId = window.localStorage.getItem(sessionKey);
    if (savedToken) {
      setToken(savedToken);
      void hydrate(savedToken, savedSessionId);
    }
  }, []);

  useEffect(() => {
    return () => {
      for (const url of Object.values(imageUrls)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [imageUrls]);

  async function handleLogin(email: string, password: string) {
    const result = await login(email, password);
    window.localStorage.setItem(tokenKey, result.token);
    setToken(result.token);
    await hydrate(result.token, window.localStorage.getItem(sessionKey));
  }

  async function hydrate(nextToken: string, savedSessionId: string | null) {
    setError(null);
    try {
      const [nextSessions, detail] = await Promise.all([listSessions(nextToken), loadSavedOrLatestSession(nextToken, savedSessionId)]);
      setSessions(nextSessions);
      if (detail) {
        setSessionId(detail.session.id);
        window.localStorage.setItem(sessionKey, detail.session.id);
        await loadScreenshots(nextToken, detail.session.id);
      } else if (savedSessionId) {
        window.localStorage.removeItem(sessionKey);
      }
    } catch (hydrateError) {
      setError(hydrateError instanceof Error ? hydrateError.message : "加载会话失败");
    }
  }

  async function selectSession(nextSessionId: string) {
    if (!token || !nextSessionId) {
      return;
    }
    setError(null);
    try {
      await getSession(token, nextSessionId);
      setSessionId(nextSessionId);
      window.localStorage.setItem(sessionKey, nextSessionId);
      await loadScreenshots(token, nextSessionId);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "加载会话失败");
    }
  }

  async function loadScreenshots(nextToken = token, nextSessionId = sessionId) {
    if (!nextToken || !nextSessionId) {
      return;
    }
    setError(null);
    try {
      const nextArtifacts = await listScreenshots(nextToken, nextSessionId);
      setArtifacts(nextArtifacts);
      const entries = await Promise.all(nextArtifacts.map(async (artifact) => [artifact.id, await getArtifactBlobUrl(nextToken, artifact.id)] as const));
      setImageUrls(Object.fromEntries(entries));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载截图失败");
    }
  }

  async function capture() {
    if (!token || !sessionId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createScreenshot(token, sessionId);
      await loadScreenshots(token, sessionId);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "截图失败");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-5 sm:px-6 lg:pb-8">
        <LoginPanel onLogin={handleLogin} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">截图</h1>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">{sessionId ? `会话 ${sessionId}` : "请先新建聊天会话。"}</p>
        </div>
        <div className="flex gap-2">
          <select className="h-11 max-w-[13rem] rounded-full border border-black/10 bg-white/75 px-4 text-sm outline-none dark:border-white/10 dark:bg-white/10" disabled={!sessions.length || busy} value={sessionId ?? ""} onChange={(event) => void selectSession(event.target.value)}>
            <option value="">最近会话</option>
            {sessions.map((item) => (
              <option key={item.session.id} value={item.session.id}>
                {sessionTitleLabel(item.session.title) ?? item.session.id}
              </option>
            ))}
          </select>
          <button className="inline-flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white/75 px-4 text-sm dark:border-white/10 dark:bg-white/10" disabled={!sessionId || busy} onClick={() => void loadScreenshots()} type="button">
            <RefreshCw size={16} />
            刷新
          </button>
          <button className="inline-flex h-11 items-center gap-2 rounded-full bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black" disabled={!sessionId || busy} onClick={capture} type="button">
            <Camera size={16} />
            截图
          </button>
        </div>
      </div>
      {error ? <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {artifacts.length ? (
          artifacts.map((artifact) => (
            <figure key={artifact.id} className="overflow-hidden rounded-[1.5rem] border border-black/5 bg-white/70 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
              {imageUrls[artifact.id] ? <img alt={artifact.name} className="aspect-video w-full bg-neutral-950 object-cover" src={imageUrls[artifact.id]} /> : <div className="aspect-video bg-neutral-950" />}
              <figcaption className="truncate px-4 py-3 text-sm text-black/60 dark:text-white/60">{artifact.name}</figcaption>
            </figure>
          ))
        ) : (
          <div className="aspect-video rounded-[1.5rem] border border-dashed border-black/10 bg-white/65 p-6 text-sm text-black/55 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-white/55">
            还没有截图。
          </div>
        )}
      </div>
    </main>
  );
}
