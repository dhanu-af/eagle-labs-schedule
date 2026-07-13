"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/ui";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

type LoginEventRow = {
  id: string;
  username: string;
  fullName: string | null;
  role: string | null;
  loginAt: string;
  logoutAt: string | null;
  durationSeconds: number | null;
  status: "SUCCESS" | "FAILED";
  ipAddress: string | null;
  browser: string;
  os: string;
  device: string;
};

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LoginHistoryClient({
  events,
  total,
  page,
  pageSize,
  users,
  filters,
}: {
  events: LoginEventRow[];
  total: number;
  page: number;
  pageSize: number;
  users: { username: string; fullName: string }[];
  filters: { q: string; start: string; end: string; user: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q);
  const [start, setStart] = useState(filters.start);
  const [end, setEnd] = useState(filters.end);
  const [user, setUser] = useState(filters.user);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (user) params.set("user", user);
    router.push(`/login-history?${params.toString()}`);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (user) params.set("user", user);
    params.set("page", String(p));
    router.push(`/login-history?${params.toString()}`);
  }

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (start) exportParams.set("start", start);
  if (end) exportParams.set("end", end);
  if (user) exportParams.set("user", user);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Login History"
        subtitle="Audit trail of every login attempt across the app."
        actions={
          <div className="flex gap-2 print:hidden">
            <a
              href={`/api/reports/login-history?${exportParams.toString()}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted active:scale-[0.98]"
            >
              Export to Excel
            </a>
            <Button variant="secondary" onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          </div>
        }
      />

      <form onSubmit={applyFilters} className="card-shadow flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4 print:hidden">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Username or name..."
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">From</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">To</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">User</span>
          <select
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.username} value={u.username}>
                {u.username} ({u.fullName})
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Apply</Button>
      </form>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <Th>User ID</Th>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Login Date</Th>
              <Th>Login Time</Th>
              <Th>Logout Time</Th>
              <Th>Duration</Th>
              <Th>Status</Th>
              <Th>IP Address</Th>
              <Th>Device</Th>
              <Th>Browser</Th>
              <Th>OS</Th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const loginDate = new Date(e.loginAt);
              return (
                <tr key={e.id} className="border-b border-border last:border-0 transition-colors duration-150 ease-out even:bg-surface-muted/30 hover:bg-surface-muted/60">
                  <td className="px-3 py-2.5 font-medium text-foreground">{e.username}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.fullName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.role ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(loginDate)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{loginDate.toLocaleTimeString("en-AU")}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {e.logoutAt ? new Date(e.logoutAt).toLocaleTimeString("en-AU") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDuration(e.durationSeconds)}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={e.status === "SUCCESS" ? "success" : "danger"}>
                      {e.status === "SUCCESS" ? "Success" : "Failed"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.ipAddress ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.device}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.browser}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.os}</td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={12}>
                  <EmptyState title="No login events match these filters." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between print:hidden">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} total events
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              ← Prev
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
