"use client";

import type { Agent, Message, Session, SessionListItem } from "@aic/core";
import { Bot, RefreshCw, SendHorizontal, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LoginPanel } from "../../components/login-panel";
import { MarkdownMessage } from "../../components/markdown-message";
import { createSession, getSession, listAgents, listMessages, listSessions, loadSavedOrLatestSession, login, sendMessage, stopSession } from "../../lib/api-client";
import { agentLabel, sessionTitleLabel } from "../../lib/display";

const tokenKey = "aic.token";
const sessionKey = "aic.sessionId";

export default function ChatPage() {
  const [token, setToken] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [agentId, setAgentId] = useState("agt_noop");
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
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

  const selectedAgentName = useMemo(() => agentLabel(agents.find((agent) => agent.id === agentId)?.name ?? "No-op Agent"), [agents, agentId]);

  async function handleLogin(email: string, password: string) {
    const result = await login(email, password);
    window.localStorage.setItem(tokenKey, result.token);
    setToken(result.token);
    await hydrate(result.token, window.localStorage.getItem(sessionKey));
  }

  async function hydrate(nextToken: string, savedSessionId: string | null) {
    setError(null);
    const [nextAgents, nextSessions] = await Promise.all([listAgents(nextToken), listSessions(nextToken)]);
    setAgents(nextAgents);
    setSessions(nextSessions);
    const detail = await loadSavedOrLatestSession(nextToken, savedSessionId);
    if (detail) {
      setSession(detail.session);
      setAgentId(detail.session.agentId);
      setMessages(await listMessages(nextToken, detail.session.id));
      window.localStorage.setItem(sessionKey, detail.session.id);
    } else if (savedSessionId) {
      window.localStorage.removeItem(sessionKey);
    }
  }

  async function startSession() {
    if (!token) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextSession = await createSession(token, { agentId, title: `${selectedAgentName} 会话` });
      setSession(nextSession);
      setMessages([]);
      window.localStorage.setItem(sessionKey, nextSession.id);
      setSessions(await listSessions(token));
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "新建会话失败");
    } finally {
      setBusy(false);
    }
  }

  async function selectSession(sessionId: string) {
    if (!token || !sessionId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const detail = await getSession(token, sessionId);
      setSession(detail.session);
      setAgentId(detail.session.agentId);
      setMessages(await listMessages(token, sessionId));
      window.localStorage.setItem(sessionKey, sessionId);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "加载会话失败");
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage() {
    if (!token || !session || !draft.trim()) {
      return;
    }
    const content = draft.trim();
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const message = await sendMessage(token, session.id, { content, contentFormat: "markdown" });
      setMessages((current) => [...current, message]);
    } catch (sendError) {
      setDraft(content);
      setError(sendError instanceof Error ? sendError.message : "发送消息失败");
    } finally {
      setBusy(false);
    }
  }

  async function stopCurrentSession() {
    if (!token || !session) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await stopSession(token, session.id);
      setSession((current) => (current ? { ...current, status: "stopped" } : current));
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "停止会话失败");
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
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col px-4 pb-28 pt-5 sm:px-6 lg:pb-8">
      <header className="mb-4 flex flex-col gap-3 rounded-[1.5rem] border border-black/5 bg-white/70 p-4 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
            <Bot size={18} />
          </div>
          <div>
            <p className="text-xs text-black/50 dark:text-white/50">当前会话</p>
            <h1 className="text-base font-semibold">{session?.id ?? "暂无会话"}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <select className="h-11 max-w-[13rem] rounded-full border border-black/10 bg-white/80 px-4 text-sm outline-none dark:border-white/10 dark:bg-black/20" disabled={busy || !sessions.length} value={session?.id ?? ""} onChange={(event) => void selectSession(event.target.value)}>
            <option value="">最近会话</option>
            {sessions.map((item) => (
              <option key={item.session.id} value={item.session.id}>
                {sessionTitleLabel(item.session.title) ?? item.session.id}
              </option>
            ))}
          </select>
          <select className="h-11 rounded-full border border-black/10 bg-white/80 px-4 text-sm outline-none dark:border-white/10 dark:bg-black/20" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agentLabel(agent.name)}
              </option>
            ))}
          </select>
          <button className="inline-flex h-11 items-center gap-2 rounded-full bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black" disabled={busy} onClick={startSession} type="button">
            <RefreshCw size={16} />
            新建
          </button>
          <button className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/75 text-red-600 disabled:opacity-40 dark:border-white/10 dark:bg-white/10" disabled={!session || busy || session.status === "stopped"} onClick={() => void stopCurrentSession()} type="button" aria-label="停止会话">
            <Square size={16} />
          </button>
        </div>
      </header>

      {error ? <p className="mb-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}

      <div className="flex-1 space-y-4">
        {messages.length ? (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        ) : (
          <MessageBubble message={{ id: "empty", sessionId: session?.id ?? "", role: "system", content: "先新建会话，再发送开发指令。消息会由服务端保存。", contentFormat: "markdown", createdAt: new Date().toISOString() }} />
        )}
      </div>

      <form
        className="sticky bottom-20 mt-5 rounded-[1.5rem] border border-black/10 bg-white/85 p-2 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/85 lg:bottom-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submitMessage();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none"
            disabled={!session || busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitMessage();
              }
            }}
            placeholder={session ? "发送开发指令..." : "请先新建会话"}
            rows={1}
            value={draft}
          />
          <button className="grid h-11 w-11 place-items-center rounded-full bg-black text-white disabled:opacity-40 dark:bg-white dark:text-black" disabled={!session || busy || !draft.trim()} type="submit" aria-label="发送">
            <SendHorizontal size={18} />
          </button>
        </div>
      </form>
    </main>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[84%] rounded-[1.35rem] px-4 py-3 text-sm leading-6 ${isUser ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white/75 dark:bg-white/10"}`}>
        {message.contentFormat === "markdown" ? <MarkdownMessage content={message.content} inverted={isUser} /> : <p className="whitespace-pre-wrap">{message.content}</p>}
      </div>
    </div>
  );
}
