"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import ThemeToggle from "@/components/theme-toggle";
import NotificationBell from "@/components/notification-bell";
import { logoutAction } from "@/lib/actions/auth-actions";
import { initials } from "@/lib/ui";
import { Button } from "@/components/ui/Button";

type NavItem = { href: string; label: string; icon: React.ReactNode };
type NavGroup = { label: string; items: NavItem[] };

const ROLE_DISPLAY: Record<string, string> = {
  SUPER_ADMIN: "super admin",
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  TEAM_LEAD: "team lead",
  QA: "qa",
  EMPLOYEE: "operator",
};

const icons = {
  dashboard: "🏠",
  myTask: "✅",
  daily: "📅",
  weekly: "📆",
  kpi: "📊",
  checks: "✔️",
  formulationChecker: "🧪",
  askDhanu: "🤖",
  teamChat: "💬",
  reports: "📈",
  team: "👥",
  audit: "📋",
  userManagement: "👤",
  loginHistory: "🔐",
};

type Notification = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export default function AppShell({
  user,
  notifications,
  children,
}: {
  user: { name: string; role: string };
  notifications: Notification[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const isManager = isAdmin || user.role === "SUPERVISOR";
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const groups: NavGroup[] = [
    {
      label: "Operations",
      items: [
        { href: "/", label: "Dashboard", icon: icons.dashboard },
        { href: "/my-task", label: "My Tasks", icon: icons.myTask },
        { href: "/daily", label: "Daily Operations", icon: icons.daily },
        { href: "/weekly", label: "Weekly Operations", icon: icons.weekly },
        { href: "/kpi", label: "Performance Analytics", icon: icons.kpi },
        { href: "/checks", label: "Quality Checks", icon: icons.checks },
        { href: "/formulation-checker", label: "Formula Manager", icon: icons.formulationChecker },
        { href: "/ask-dhanu", label: "Dhanu AI", icon: icons.askDhanu },
        { href: "/team-chat", label: "Team Hub", icon: icons.teamChat },
      ],
    },
    ...(isManager
      ? [
          {
            label: "Admin",
            items: [
              { href: "/reports", label: "Reports & Analytics", icon: icons.reports },
              ...(isAdmin ? [{ href: "/team", label: "Production Team", icon: icons.team }] : []),
              ...(isAdmin ? [{ href: "/audit", label: "Audit Trail", icon: icons.audit }] : []),
              ...(isSuperAdmin
                ? [
                    { href: "/user-management", label: "User Management", icon: icons.userManagement },
                    { href: "/login-history", label: "Access History", icon: icons.loginHistory },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];

  const NavLinks = (
    <nav className="flex flex-col gap-5 px-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ease-out",
                    active
                      ? "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgba(52,211,153,0.18)]"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--glow-primary)]" />
                  )}
                  <span
                    className={clsx(
                      "inline-flex w-[18px] shrink-0 items-center justify-center text-base leading-none transition-transform duration-200",
                      active ? "" : "group-hover:scale-110"
                    )}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="glass hidden md:flex md:w-64 md:flex-col border-r border-border py-6">
        <div className="mb-7 flex items-center gap-2.5 px-5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-emerald-950"
            style={{
              background: "linear-gradient(135deg, #34d399 0%, #10b981 55%, #0d9488 100%)",
              boxShadow: "0 0 16px var(--glow-primary)",
            }}
          >
            EL
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">Eagle Labs Australia</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              BlendCaps Dashboard
            </p>
          </div>
        </div>
        {NavLinks}
      </aside>

      <div
        className={clsx(
          "fixed inset-0 z-40 md:hidden transition-opacity duration-200",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
        <aside
          className={clsx(
            "glass absolute left-0 top-0 h-full w-64 overflow-y-auto border-r border-border py-6 transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-7 flex items-center justify-between px-5">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-emerald-950"
                style={{ background: "linear-gradient(135deg, #34d399 0%, #10b981 55%, #0d9488 100%)" }}
              >
                EL
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-foreground">Eagle Labs Australia</p>
                <p className="text-[11px] leading-tight text-muted-foreground">BlendCaps Dashboard</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close menu">
              ✕
            </button>
          </div>
          {NavLinks}
        </aside>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass sticky top-0 z-30 flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="text-foreground md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            {isSuperAdmin ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--glow-primary)]" />
                Super Admin — full access
              </span>
            ) : (
              <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
                View only
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell notifications={notifications} />
            <ThemeToggle />
            <div className="flex items-center gap-2 pl-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-emerald-950"
                style={{
                  background: "linear-gradient(135deg, #6ee7b7 0%, #34d399 60%, #2dd4bf 100%)",
                }}
              >
                {initials(user.name)}
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium leading-tight text-foreground">{user.name}</p>
                <p className="text-xs leading-tight capitalize text-muted-foreground">
                  {ROLE_DISPLAY[user.role] ?? user.role.toLowerCase().replace("_", " ")}
                </p>
              </div>
            </div>
            <Link
              href="/change-password"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted active:scale-[0.98]"
            >
              Change Password
            </Link>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </header>
        <main className="animate-in flex-1 bg-background px-4 py-4 md:px-6 md:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
