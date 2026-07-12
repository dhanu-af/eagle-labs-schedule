"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import ThemeToggle from "@/components/theme-toggle";
import NotificationBell from "@/components/notification-bell";
import { logoutAction } from "@/lib/actions/auth-actions";
import { initials } from "@/lib/ui";

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
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  daily: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  ),
  myTask: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2.5 20c0-3.6 3-6.5 6.5-6.5.9 0 1.7.18 2.5.5" />
      <path d="M14.5 15.5l2 2 4-4" />
    </svg>
  ),
  weekly: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
    </svg>
  ),
  kpi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 15l3-4 3 2 5-6" />
    </svg>
  ),
  attendance: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  ),
  payroll: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 6v-.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V6" />
    </svg>
  ),
  reports: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  ),
  team: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M2 21c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M17 12.5c2.5.3 5 2 5 5.5" />
    </svg>
  ),
  audit: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  askDhanu: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 17.5v.01" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.2 1.9-2 2.6-.6.5-.8 1-.8 1.65" />
      <circle cx="12" cy="12" r="9.5" />
    </svg>
  ),
  userManagement: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 3-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <path d="M17 8.5h4M19 6.5v4" />
    </svg>
  ),
  loginHistory: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  checks: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12l2 2 4-4M8 17h5" />
    </svg>
  ),
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
        { href: "/my-task", label: "My Task", icon: icons.myTask },
        { href: "/daily", label: "Daily Planner", icon: icons.daily },
        { href: "/weekly", label: "Weekly Planner", icon: icons.weekly },
        { href: "/kpi", label: "KPI Tracking", icon: icons.kpi },
        { href: "/checks", label: "Checks", icon: icons.checks },
        { href: "/ask-dhanu", label: "Ask Dhanu", icon: icons.askDhanu },
      ],
    },
    ...(isManager
      ? [
          {
            label: "Admin",
            items: [
              { href: "/reports", label: "Reports", icon: icons.reports },
              ...(isAdmin ? [{ href: "/team", label: "The Heart of Production", icon: icons.team }] : []),
              ...(isAdmin ? [{ href: "/audit", label: "Audit Log", icon: icons.audit }] : []),
              ...(isSuperAdmin
                ? [
                    { href: "/user-management", label: "User Management", icon: icons.userManagement },
                    { href: "/login-history", label: "Login History", icon: icons.loginHistory },
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
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
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
                      "transition-transform duration-200",
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
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
            >
              Change Password
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
              >
                Log out
              </button>
            </form>
          </div>
        </header>
        <main className="animate-in flex-1 p-4 md:p-6 bg-background">{children}</main>
      </div>
    </div>
  );
}
