"use client";

import type { DashboardResponse, Notification } from "@aic/core";
import { Activity, Bell, Cpu, FolderGit2, RefreshCw, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { LoginPanel } from "../../components/login-panel";
import { StatusPill } from "../../components/status-pill";
import { createTestNotification, listNotifications, loadDashboard, login, markNotificationDelivered } from "../../lib/api-client";
import { fileChangeLabel, notificationStatusLabel } from "../../lib/display";

const tokenKey = "aic.token";

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(tokenKey);
    if (savedToken) {
      setToken(savedToken);
      void refresh(savedToken);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh(token);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [token]);

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
    setBusy(true);
    setError(null);
    try {
      const [nextDashboard, nextNotifications] = await Promise.all([loadDashboard(nextToken), listNotifications(nextToken)]);
      setDashboard(nextDashboard);
      setNotifications(nextNotifications);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "加载总览失败");
    } finally {
      setBusy(false);
    }
  }

  async function testNotification() {
    if (!token) {
      return;
    }
    setError(null);
    try {
      const notification = await createTestNotification(token);
      setNotifications((current) => [notification, ...current]);
    } catch (notificationError) {
      setError(notificationError instanceof Error ? notificationError.message : "创建通知失败");
    }
  }

  async function markRead(notificationId: string) {
    if (!token) {
      return;
    }
    const updated = await markNotificationDelivered(token, notificationId);
    setNotifications((current) => current.map((notification) => (notification.id === updated.id ? updated : notification)));
  }

  if (!token) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-5 sm:px-6 lg:pb-8">
        <LoginPanel onLogin={handleLogin} />
      </main>
    );
  }

  const summary = {
    task: dashboard?.currentSession?.title ?? "等待本地智能体",
    status: dashboard?.status ?? "unavailable",
    duration: dashboard?.durationSeconds == null ? "暂无" : `${dashboard.durationSeconds} 秒`,
    metrics:
      dashboard?.system.cpuPercent == null && dashboard?.system.memoryPercent == null
        ? "暂无"
        : `${dashboard?.system.cpuPercent ?? "暂无"}% / ${dashboard?.system.memoryPercent ?? "暂无"}%`,
    branch: dashboard?.git.branch ?? "暂无",
    commit: dashboard?.git.commit ?? "暂无",
    path: dashboard?.workspace?.path ?? "未连接"
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
      <section className="rounded-[2rem] border border-black/5 bg-white/70 p-6 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm text-black/50 dark:text-white/50">当前任务</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink dark:text-white">{summary.task}</h1>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={summary.status} />
            <button className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/10" disabled={busy} onClick={() => void refresh()} aria-label="刷新总览">
              <RefreshCw size={17} />
            </button>
          </div>
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Timer size={18} />} label="运行时间" value={summary.duration} />
          <Metric icon={<Cpu size={18} />} label="CPU / 内存" value={summary.metrics} />
          <Metric icon={<FolderGit2 size={18} />} label="Git" value={`${summary.branch} · ${summary.commit}`} />
          <Metric icon={<Activity size={18} />} label="项目路径" value={summary.path} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[1.5rem] border border-black/5 bg-white/65 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
          <h2 className="text-base font-semibold">最近修改文件</h2>
          {dashboard?.recentFiles.length ? (
            <div className="mt-4 space-y-2">
              {dashboard.recentFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2 text-sm dark:bg-black/20">
                  <span className="flex-1 truncate">{file.path}</span>
                  <span className="rounded-full bg-black/5 px-2 py-1 text-[11px] text-black/55 dark:bg-white/10 dark:text-white/60">{fileChangeLabel(file.changeType)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">还没有捕获到文件修改。</div>
          )}
        </div>
        <div className="rounded-[1.5rem] border border-black/5 bg-white/65 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">通知</h2>
            <button className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/10" onClick={() => void testNotification()} aria-label="创建测试通知">
              <Bell size={16} />
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {notifications.length ? (
              notifications.slice(0, 6).map((notification) => (
                <button key={notification.id} className="w-full rounded-2xl bg-white/70 px-3 py-3 text-left text-sm dark:bg-black/20" onClick={() => void markRead(notification.id)} type="button">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{notification.title}</span>
                    <span className="text-[11px] text-black/45 dark:text-white/45">{notificationStatusLabel(notification.status)}</span>
                  </div>
                  {notification.body ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-black/50 dark:text-white/50">{notification.body}</p> : null}
                </button>
              ))
            ) : (
              <p className="text-sm leading-6 text-black/55 dark:text-white/55">还没有通知。点击铃铛可以创建一条测试通知。</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/80 p-4 dark:border-white/10 dark:bg-black/20">
      <div className="flex items-center gap-2 text-black/50 dark:text-white/50">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-3 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
