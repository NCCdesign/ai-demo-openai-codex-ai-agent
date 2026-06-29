"use client";

import type { FileChange, SessionListItem } from "@aic/core";
import { FileDiff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { LoginPanel } from "../../components/login-panel";
import { getSession, getFileChangeDiff, listFileChanges, listSessions, loadSavedOrLatestSession, login, refreshFileChanges } from "../../lib/api-client";
import { fileChangeLabel, sessionTitleLabel } from "../../lib/display";

const tokenKey = "aic.token";
const sessionKey = "aic.sessionId";

export default function FilesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [selected, setSelected] = useState<{ path: string; diff: string | null } | null>(null);
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
        await loadChanges(nextToken, detail.session.id);
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
      setSelected(null);
      window.localStorage.setItem(sessionKey, nextSessionId);
      await loadChanges(token, nextSessionId);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "加载会话失败");
    }
  }

  async function loadChanges(nextToken = token, nextSessionId = sessionId) {
    if (!nextToken || !nextSessionId) {
      return;
    }
    setError(null);
    try {
      setChanges(await listFileChanges(nextToken, nextSessionId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载文件修改失败");
    }
  }

  async function refresh() {
    if (!token || !sessionId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextChanges = await refreshFileChanges(token, sessionId);
      setChanges(nextChanges);
      setSelected(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "刷新文件修改失败");
    } finally {
      setBusy(false);
    }
  }

  async function selectChange(change: FileChange) {
    if (!token) {
      return;
    }
    setError(null);
    try {
      const diff = await getFileChangeDiff(token, change.id);
      setSelected({ path: diff.path, diff: diff.diff });
    } catch (diffError) {
      setError(diffError instanceof Error ? diffError.message : "加载差异失败");
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
          <h1 className="text-2xl font-semibold">文件修改</h1>
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
          <button className="inline-flex h-11 items-center gap-2 rounded-full bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black" disabled={!sessionId || busy} onClick={refresh} type="button">
            <RefreshCw size={16} />
            刷新
          </button>
        </div>
      </div>
      {error ? <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <section className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[1.5rem] border border-black/5 bg-white/70 p-3 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
          {changes.length ? (
            <div className="space-y-2">
              {changes.map((change) => (
                <button key={change.id} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/10" onClick={() => void selectChange(change)} type="button">
                  <FileDiff size={17} />
                  <span className="flex-1 truncate">{change.path}</span>
                  <span className="rounded-full bg-black/5 px-2 py-1 text-[11px] text-black/55 dark:bg-white/10 dark:text-white/60">{fileChangeLabel(change.changeType)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-black/55 dark:text-white/55">还没有捕获到文件修改。</div>
          )}
        </div>
        <pre className="min-h-[70vh] overflow-auto rounded-[1.5rem] border border-black/5 bg-neutral-950 p-4 text-[12px] leading-5 text-neutral-100 shadow-soft">
          {selected ? selected.diff || `没有文本差异：${selected.path}` : "选择一个文件修改查看差异。"}
        </pre>
      </section>
    </main>
  );
}
