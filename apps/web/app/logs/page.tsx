"use client";

import type { LogLine, SessionListItem } from "@aic/core";
import { Download, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { LoginPanel } from "../../components/login-panel";
import { apiBaseUrl, getLogsDownloadBlobUrl, getSession, listLogs, listSessions, loadSavedOrLatestSession, login } from "../../lib/api-client";
import { logStreamLabel, sessionTitleLabel } from "../../lib/display";

const tokenKey = "aic.token";
const sessionKey = "aic.sessionId";

export default function LogsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const logPanelRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(tokenKey);
    const savedSessionId = window.localStorage.getItem(sessionKey);
    if (savedToken) {
      setToken(savedToken);
      void hydrate(savedToken, savedSessionId);
    }
  }, []);

  useEffect(() => {
    if (!token || !sessionId) {
      return;
    }
    void refreshLogs(token, sessionId);
  }, [token, sessionId]);

  useEffect(() => {
    if (!token || !sessionId) {
      return;
    }
    const socket = io(apiBaseUrl, {
      auth: { token },
      transports: ["websocket", "polling"]
    });
    socket.emit("session:join", { sessionId });
    socket.on("log:line", (event: { log: LogLine }) => {
      setLogs((current) => [...current, event.log]);
    });
    socket.on("connect_error", (socketError) => {
      setError(socketError.message);
    });
    return () => {
      socket.emit("session:leave", { sessionId });
      socket.disconnect();
    };
  }, [token, sessionId]);

  const visibleLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return logs;
    }
    return logs.filter((log) => log.line.toLowerCase().includes(needle) || log.stream.toLowerCase().includes(needle));
  }, [logs, query]);

  useEffect(() => {
    const panel = logPanelRef.current;
    if (panel) {
      panel.scrollTop = panel.scrollHeight;
    }
  }, [visibleLogs]);

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
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "加载会话失败");
    }
  }

  async function refreshLogs(nextToken = token, nextSessionId = sessionId) {
    if (!nextToken || !nextSessionId) {
      return;
    }
    setError(null);
    try {
      const response = await listLogs(nextToken, nextSessionId);
      setLogs(response.logs);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "加载日志失败");
    }
  }

  async function downloadLogs() {
    if (!token || !sessionId) {
      return;
    }
    setError(null);
    try {
      const url = await getLogsDownloadBlobUrl(token, sessionId);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sessionId}-logs.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "下载日志失败");
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-28 pt-5 sm:px-6 lg:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">实时日志</h1>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">{sessionId ? `会话 ${sessionId}` : "先新建聊天会话，再查看实时日志。"}</p>
        </div>
        <div className="flex gap-2">
          <select className="h-11 max-w-[13rem] rounded-full border border-black/10 bg-white/75 px-4 text-sm outline-none dark:border-white/10 dark:bg-white/10" disabled={!sessions.length} value={sessionId ?? ""} onChange={(event) => void selectSession(event.target.value)}>
            <option value="">最近会话</option>
            {sessions.map((item) => (
              <option key={item.session.id} value={item.session.id}>
                {sessionTitleLabel(item.session.title) ?? item.session.id}
              </option>
            ))}
          </select>
          <label className="flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white/75 px-4 text-sm dark:border-white/10 dark:bg-white/10">
            <Search size={16} />
            <input className="w-40 bg-transparent outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="搜索日志" value={query} />
          </label>
          <button className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/75 dark:border-white/10 dark:bg-white/10" onClick={() => void refreshLogs()} aria-label="刷新日志">
            <RefreshCw size={17} />
          </button>
          <button className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/75 disabled:opacity-40 dark:border-white/10 dark:bg-white/10" disabled={!sessionId} onClick={() => void downloadLogs()} aria-label="下载日志">
            <Download size={17} />
          </button>
        </div>
      </div>
      {error ? <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <pre ref={logPanelRef} className="min-h-[70vh] overflow-auto rounded-[1.5rem] border border-black/5 bg-neutral-950 p-4 text-[13px] leading-6 text-green-100 shadow-soft">
        {visibleLogs.length ? visibleLogs.map((log) => `[${logStreamLabel(log.stream)}] ${log.line}`).join("\n") : "还没有日志。"}
      </pre>
    </main>
  );
}
