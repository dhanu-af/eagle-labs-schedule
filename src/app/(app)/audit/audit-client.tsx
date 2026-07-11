"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LogEntry = {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  summary: string;
  createdAt: string;
};

function actionTone(action: string): { color: string; icon: string } {
  if (action.startsWith("CREATE") || action === "APPROVE_USER") return { color: "var(--success)", icon: "+" };
  if (action.startsWith("DELETE") || action === "REJECT_USER") return { color: "var(--danger)", icon: "×" };
  if (action.startsWith("UPDATE") || action.startsWith("MOVE") || action.startsWith("RECORD"))
    return { color: "var(--info)", icon: "✎" };
  if (action.includes("FINALIZE") || action.includes("GENERATE")) return { color: "var(--primary)", icon: "$" };
  return { color: "var(--muted-foreground)", icon: "•" };
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });
}

export default function AuditClient({
  logs,
  entityTypes,
  currentQuery,
  currentEntityType,
}: {
  logs: LogEntry[];
  entityTypes: string[];
  currentQuery: string;
  currentEntityType: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(currentQuery);
  const [entityType, setEntityType] = useState(currentEntityType);
  const [view, setView] = useState<"timeline" | "table">("timeline");

  function applyFilters(nextQ: string, nextType: string) {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextType) params.set("entityType", nextType);
    router.push(`/audit?${params.toString()}`);
  }

  const groups = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const log of logs) {
      const key = dayLabel(log.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return Array.from(map.entries());
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Full trail of who changed what, across every module. Showing latest 200 entries.
          </p>
        </div>
        <div className="flex rounded-lg border border-border bg-surface p-0.5">
          <button
            onClick={() => setView("timeline")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              view === "timeline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setView("table")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters(q, entityType)}
          placeholder="Search actor, action, summary..."
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            applyFilters(q, e.target.value);
          }}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All entity types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={() => applyFilters(q, entityType)}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Search
        </button>
      </div>

      {logs.length === 0 && (
        <div className="card-shadow rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          No audit entries match this filter.
        </div>
      )}

      {view === "timeline" ? (
        <div className="space-y-6">
          {groups.map(([day, entries]) => (
            <div key={day}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                {day}
              </p>
              <div className="card-shadow relative rounded-2xl border border-border bg-surface p-5">
                <div className="absolute bottom-5 left-[27px] top-5 w-px bg-border" />
                <div className="space-y-4">
                  {entries.map((l) => {
                    const tone = actionTone(l.action);
                    return (
                      <div key={l.id} className="relative flex gap-3 pl-0">
                        <div
                          className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold"
                          style={{
                            color: tone.color,
                            borderColor: tone.color,
                            background: "var(--surface)",
                            boxShadow: `0 0 8px color-mix(in srgb, ${tone.color} 40%, transparent)`,
                          }}
                        >
                          {tone.icon}
                        </div>
                        <div className="min-w-0 flex-1 pb-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{l.actorName}</span>
                            <span className="text-xs text-muted-foreground">
                              ({l.actorRole.replace("_", " ")})
                            </span>
                            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {l.entityType}
                            </span>
                            <span className="ml-auto text-[11px] text-muted-foreground">
                              {new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{l.summary}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 align-top transition-colors hover:bg-surface-muted/50">
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-foreground">
                    {l.actorName}
                    <span className="ml-1 text-xs text-muted-foreground">({l.actorRole.replace("_", " ")})</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-foreground">{l.action}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{l.entityType}</td>
                  <td className="px-4 py-2 text-muted-foreground">{l.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
