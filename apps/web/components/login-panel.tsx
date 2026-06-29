"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";

export function LoginPanel({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("admin@example.local");
  const [password, setPassword] = useState("change-me");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto mt-10 w-full max-w-md rounded-[1.5rem] border border-black/5 bg-white/75 p-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
          <KeyRound size={18} />
        </div>
        <div>
          <h1 className="text-lg font-semibold">登录</h1>
          <p className="text-sm text-black/50 dark:text-white/50">使用本地控制台管理员账号。</p>
        </div>
      </div>
      <form
        className="mt-5 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await onLogin(email, password);
          } catch (loginError) {
            setError(loginError instanceof Error ? loginError.message : "登录失败");
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className="h-11 w-full rounded-2xl border border-black/10 bg-white/80 px-4 text-sm outline-none dark:border-white/10 dark:bg-black/20"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="邮箱"
        />
        <input
          className="h-11 w-full rounded-2xl border border-black/10 bg-white/80 px-4 text-sm outline-none dark:border-white/10 dark:bg-black/20"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="密码"
          type="password"
        />
        {error ? <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        <button className="h-11 w-full rounded-full bg-black text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black" disabled={busy} type="submit">
          {busy ? "登录中..." : "登录"}
        </button>
      </form>
    </div>
  );
}
