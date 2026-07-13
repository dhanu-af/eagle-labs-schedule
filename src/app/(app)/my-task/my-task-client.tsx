"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PRIORITY_CLASS, PRIORITY_LABEL, STATUS_CLASS, STATUS_LABEL, formatBrisbaneDate, initials, pct } from "@/lib/ui";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type Role = "SUPER_ADMIN" | "ADMIN" | "SUPERVISOR" | "TEAM_LEAD" | "QA" | "EMPLOYEE";

export type MyTaskEmployee = {
  id: string;
  name: string;
  role: Role;
  teamId: string;
  teamName: string;
};

export type MyTaskItem = {
  id: string;
  employeeId: string | null;
  teamName: string;
  product: string;
  batchNo: string | null;
  process: string;
  targetQty: number | null;
  targetUnit: string;
  actualQty: number;
  plannedStart: string | null;
  plannedFinish: string | null;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "NOT_STARTED" | "RUNNING" | "COMPLETED" | "DELAYED";
};

export type MyTaskKpi = { teamName: string; name: string; target: number; unit: string };
export type MyTaskSop = { id: string; title: string; keywords: string; answer: string };

const CATEGORY_ORDER = [
  "Blending Operator",
  "Capsule Operator",
  "Supervisor",
  "QA/QC",
  "Team Lead",
  "Operator",
  "Admin",
];

function categoryFor(role: Role, teamName: string) {
  if (role === "EMPLOYEE") {
    if (teamName === "Blending") return "Blending Operator";
    if (teamName === "Encapsulation") return "Capsule Operator";
    return "Operator";
  }
  if (role === "SUPERVISOR") return "Supervisor";
  if (role === "QA") return "QA/QC";
  if (role === "TEAM_LEAD") return "Team Lead";
  return "Admin";
}

export default function MyTaskClient({
  dateStr,
  currentEmployeeId,
  employees,
  tasks,
  kpis,
  sops,
}: {
  dateStr: string;
  currentEmployeeId: string | null;
  employees: MyTaskEmployee[];
  tasks: MyTaskItem[];
  kpis: MyTaskKpi[];
  sops: MyTaskSop[];
}) {
  const tasksByEmployee = useMemo(() => {
    const map = new Map<string, MyTaskItem[]>();
    for (const t of tasks) {
      if (!t.employeeId) continue;
      if (!map.has(t.employeeId)) map.set(t.employeeId, []);
      map.get(t.employeeId)!.push(t);
    }
    return map;
  }, [tasks]);

  const grouped = useMemo(() => {
    const map = new Map<string, MyTaskEmployee[]>();
    for (const e of employees) {
      const cat = categoryFor(e.role, e.teamName);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(e);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, employees: map.get(c)! }));
  }, [employees]);

  const [selectedId, setSelectedId] = useState<string | null>(
    (currentEmployeeId && employees.some((e) => e.id === currentEmployeeId) ? currentEmployeeId : null) ??
      employees[0]?.id ??
      null
  );

  const selected = employees.find((e) => e.id === selectedId) ?? null;
  const selectedTasks = selected ? tasksByEmployee.get(selected.id) ?? [] : [];
  const teamKpis = selected ? kpis.filter((k) => k.teamName === selected.teamName) : [];

  const relevantSops = useMemo(() => {
    if (!selected) return [];
    const terms = selectedTasks
      .flatMap((t) => [t.product, t.process])
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const matched = sops.filter((s) => {
      const haystack = `${s.title} ${s.keywords}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    });

    if (matched.length > 0) return matched.slice(0, 5);
    if (selected.teamName === "Blending") return sops.slice(0, 5);
    return [];
  }, [selected, selectedTasks, sops]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Task"
        subtitle={
          <>
            Today&apos;s assignments by employee, synced live from the Daily Planner.
            <br />
            {formatBrisbaneDate(new Date(`${dateStr}T00:00:00Z`))}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Card padding="sm" className="space-y-4">
          {grouped.map((g) => (
            <div key={g.category}>
              <p className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {g.category}
              </p>
              <div className="space-y-1">
                {g.employees.map((e) => {
                  const count = tasksByEmployee.get(e.id)?.length ?? 0;
                  const isYou = e.id === currentEmployeeId;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors duration-150 ease-out ${
                        selected?.id === e.id
                          ? "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgba(52,211,153,0.18)]"
                          : "text-foreground hover:bg-surface-muted"
                      }`}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                        {initials(e.name)}
                      </div>
                      <span className="min-w-0 flex-1 truncate">
                        {e.name}
                        {isYou && <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>}
                      </span>
                      <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {employees.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">No active employees yet.</p>
          )}
        </Card>

        <div className="space-y-4">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-border bg-surface">
              <EmptyState title="Select an employee to see their tasks." />
            </div>
          ) : (
            <>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-foreground">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {categoryFor(selected.role, selected.teamName)} · {selected.teamName}
                    </p>
                  </div>
                  <Link href={`/daily?date=${dateStr}`} className="text-sm font-medium text-primary hover:underline">
                    Update in Daily Planner →
                  </Link>
                </div>
              </Card>

              <div className="space-y-3">
                {selectedTasks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border bg-surface">
                    <EmptyState title="No tasks assigned today." />
                  </div>
                )}
                {selectedTasks.map((t) => (
                  <Card key={t.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">
                          {t.product}
                          {t.batchNo ? ` · Batch ${t.batchNo}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">Responsibility: {t.process}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASS[t.priority]}`}>
                          {PRIORITY_LABEL[t.priority]}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[t.status]}`}>
                          {STATUS_LABEL[t.status]}
                        </span>
                      </div>
                    </div>

                    {t.targetQty !== null && (
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>
                            {t.actualQty}/{t.targetQty} {t.targetUnit} ({pct(t.actualQty, t.targetQty)}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct(t.actualQty, t.targetQty)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {t.plannedStart && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Due: {t.plannedStart}–{t.plannedFinish ?? "?"}
                      </p>
                    )}
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                  <p className="mb-2 text-sm font-semibold text-foreground">Team KPI Target</p>
                  {teamKpis.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No KPI configured for {selected.teamName}.</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {teamKpis.map((k) => (
                        <li key={k.name}>
                          {k.name} — <span className="font-medium text-foreground">{k.target} {k.unit}/day</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card>
                  <p className="mb-2 text-sm font-semibold text-foreground">Relevant SOPs</p>
                  {relevantSops.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No SOPs on file yet.{" "}
                      <Link href="/ask-dhanu" className="font-medium text-primary hover:underline">
                        Ask Dhanu →
                      </Link>
                    </p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {relevantSops.map((s) => (
                        <li key={s.id}>
                          <Link href="/ask-dhanu" className="text-primary hover:underline">
                            {s.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
