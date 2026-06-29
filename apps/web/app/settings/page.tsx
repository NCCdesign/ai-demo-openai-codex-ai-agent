"use client";

import type { AuthToken } from "@aic/core";
import { Copy, KeyRound, LogOut, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LoginPanel } from "../../components/login-panel";
import { createAuthToken, deleteAuthToken, listAuthTokens, login, logout } from "../../lib/api-client";
import { authTokenLabel } from "../../lib/display";

const tokenKey = "aic.token";

export default function SettingsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokens, setTokens] = useState<AuthToken[]>([]);
  const [name, setName] = useState("手机访问");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(tokenKey);
    if (savedToken) {
      setToken(savedToken);
      void refresh(savedToken);
    }
  }, []);

  async function handleLogin(email: string, password: string) {
    const result = await login(email, password);
    window.localStorage.setItem(tokenKey, result.token);
    setToken(result.token);
    await refresh(result.token);
  }

  async function refresh(nextToken = token) {
    if (!nextToken) {
      return;
    }
    setError(null);
    try {
      setTokens(await listAuthTokens(nextToken));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "加载访问令牌失败");
    }
  }

  async function createToken() {
    if (!token) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createAuthToken(token, { name });
      setCreatedToken(result.token);
      setTokens((current) => [result.authToken, ...current]);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "创建访问令牌失败");
    } finally {
      setBusy(false);
    }
  }

  async function removeToken(tokenId: string) {
    if (!token) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAuthToken(token, tokenId);
      setTokens((current) => current.filter((item) => item.id !== tokenId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除访问令牌失败");
    } finally {
      setBusy(false);
    }
  }

  async function copyCreatedToken() {
    if (!createdToken) {
      return;
    }
    await navigator.clipboard.writeText(createdToken);
  }

  async function logoutCurrentToken() {
    if (!token) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await logout(token);
    } finally {
      window.localStorage.removeItem(tokenKey);
      setToken(null);
      setTokens([]);
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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 pb-28 pt-5 sm:px-6 lg:pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">设置</h1>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">本地认证、访问令牌，以及未来的第三方登录预留接口。</p>
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/75 dark:border-white/10 dark:bg-white/10" disabled={busy} onClick={() => void logoutCurrentToken()} type="button" aria-label="退出登录">
          <LogOut size={17} />
        </button>
      </header>

      {error ? <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}

      <section className="rounded-[1.5rem] border border-black/5 bg-white/70 p-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold">访问令牌</h2>
            <p className="text-sm text-black/50 dark:text-white/50">新令牌只显示一次；服务端只保存哈希值。</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            className="h-11 flex-1 rounded-2xl border border-black/10 bg-white/80 px-4 text-sm outline-none dark:border-white/10 dark:bg-black/20"
            onChange={(event) => setName(event.target.value)}
            placeholder="令牌名称"
            value={name}
          />
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black" disabled={busy} onClick={() => void createToken()} type="button">
            <Plus size={16} />
            创建
          </button>
        </div>

        {createdToken ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">请现在复制这个令牌。</p>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-white/70 dark:bg-black/20" onClick={() => void copyCreatedToken()} aria-label="复制令牌" type="button">
                <Copy size={15} />
              </button>
            </div>
            <code className="mt-3 block overflow-x-auto rounded-xl bg-black/85 p-3 text-xs text-white">{createdToken}</code>
          </div>
        ) : null}

        <div className="mt-5 space-y-2">
          {tokens.length ? (
            tokens.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-3 text-sm dark:bg-black/20">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{authTokenLabel(item.name, item.id)}</p>
                  <p className="mt-1 truncate text-xs text-black/45 dark:text-white/45">
                    创建于 {formatDate(item.createdAt)} · 上次使用 {item.lastUsedAt ? formatDate(item.lastUsedAt) : "从未使用"}
                  </p>
                </div>
                <button className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white/70 text-red-600 disabled:opacity-40 dark:border-white/10 dark:bg-white/10" disabled={busy} onClick={() => void removeToken(item.id)} aria-label="删除令牌" type="button">
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-sm text-black/50 dark:border-white/10 dark:text-white/50">还没有访问令牌。</p>
          )}
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
