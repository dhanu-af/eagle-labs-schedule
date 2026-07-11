"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/ui";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Login History</h1>
          <p className="text-sm text-muted-foreground">Audit trail of every login attempt across the app.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <a
            href={`/api/reports/login-history?${exportParams.toString()}`}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Export to Excel
          </a>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <form onSubmit={applyFilters} className="card-shadow flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 print:hidden">
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
        <button
          type="submit"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Apply
        </button>
      </form>

      <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">User ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Login Date</th>
              <th className="px-3 py-2">Login Time</th>
              <th className="px-3 py-2">Logout Time</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">IP Address</th>
              <th className="px-3 py-2">Device</th>
              <th className="px-3 py-2">Browser</th>
              <th className="px-3 py-2">OS</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const loginDate = new Date(e.loginAt);
              return (
                <tr key={e.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface-muted/50">
                  <td className="px-3 py-2 font-medium text-foreground">{e.username}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.fullName ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.role ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(loginDate)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{loginDate.toLocaleTimeString("en-AU")}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {e.logoutAt ? new Date(e.logoutAt).toLocaleTimeString("en-AU") : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDuration(e.durationSeconds)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        e.status === "SUCCESS"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-danger/30 bg-danger/10 text-danger"
                      }`}
                    >
                      {e.status === "SUCCESS" ? "Success" : "Failed"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.ipAddress ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.device}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.browser}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.os}</td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No login events match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between print:hidden">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} total events
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
