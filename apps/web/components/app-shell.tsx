import Link from "next/link";
import { Activity, Files, Image, LayoutDashboard, MessageSquare, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "总览", icon: LayoutDashboard },
  { href: "/chat", label: "聊天", icon: MessageSquare },
  { href: "/logs", label: "日志", icon: Activity },
  { href: "/files", label: "文件", icon: Files },
  { href: "/screenshots", label: "截图", icon: Image },
  { href: "/settings", label: "设置", icon: Settings }
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-black/10 bg-white/70 px-4 py-5 backdrop-blur-2xl dark:border-white/10 dark:bg-black/30 lg:block">
        <Link href="/dashboard" className="block px-3 text-lg font-semibold">
          AI 开发助手控制台
        </Link>
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-black/70 transition hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10">
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">{children}</div>
      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-[1.4rem] border border-black/10 bg-white/85 p-1 shadow-soft backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/85 lg:hidden">
        {navItems.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href} className="flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] text-black/60 dark:text-white/60">
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
