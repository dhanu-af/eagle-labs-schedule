"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarDayCounts, PlanningSearchRow, PlanningSection, PlanningSummaryCounts } from "@/lib/actions/planning-search-actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const SECTIONS: { key: PlanningSection | "ALL"; label: string }[] = [
  { key: "ALL", label: "All Sections" },
  { key: "DEMAND", label: "Demand" },
  { key: "MPS", label: "MPS" },
  { key: "MATERIALS", label: "Materials" },
  { key: "PRODUCTION", label: "Production" },
  { key: "ACTIONS", label: "Actions" },
  { key: "KPI", label: "KPI" },
];

const SECTION_TONE: Record<PlanningSection, "info" | "primary" | "warning" | "success" | "danger" | "muted"> = {
  DEMAND: "info",
  MPS: "primary",
  MATERIALS: "warning",
  PRODUCTION: "success",
  ACTIONS: "danger",
  KPI: "muted",
};

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function monthLabel(monthIso: string) {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function shiftMonth(monthIso: string, delta: number) {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PlanningSearchClient({
  monthIso,
  calendar,
  summary,
  results,
  keyword,
  section,
  date,
}: {
  monthIso: string;
  calendar: { days: CalendarDayCounts[] };
  summary: PlanningSummaryCounts;
  results: PlanningSearchRow[];
  keyword: string;
  section: PlanningSection | "ALL";
  date: string;
}) {
  const router = useRouter();
  const [keywordInput, setKeywordInput] = useState(keyword);

  function pushParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams({ month: monthIso, keyword, section, date });
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.push(`/planning-search?${params.toString()}`);
  }

  const weeks: CalendarDayCounts[][] = [];
  for (let i = 0; i < calendar.days.length; i += 7) weeks.push(calendar.days.slice(i, i + 7));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Planning Calendar & Search"
        subtitle="One control tower across Demand, MPS, Materials, Production, Actions, and KPI — pick a date or search a keyword."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <p className="text-xs text-muted-foreground">Past-Due Orders</p>
          <p className="text-xl font-semibold text-danger">{summary.pastDueOrders}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-muted-foreground">Red Material Risks</p>
          <p className="text-xl font-semibold text-danger">{summary.redMaterialRisks}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-muted-foreground">Blocked MPS</p>
          <p className="text-xl font-semibold text-warning">{summary.blockedMps}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-muted-foreground">Open Red Actions</p>
          <p className="text-xl font-semibold text-danger">{summary.openRedActions}</p>
        </Card>
      </div>

      <Card padding="sm">
        <div className="mb-2 flex items-center justify-between">
          <Button size="sm" variant="secondary" onClick={() => pushParams({ month: shiftMonth(monthIso, -1) })}>
            ←
          </Button>
          <p className="text-sm font-medium text-foreground">{monthLabel(monthIso)}</p>
          <Button size="sm" variant="secondary" onClick={() => pushParams({ month: shiftMonth(monthIso, 1) })}>
            →
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {weeks.flat().map((day) => {
            const dayNum = Number(day.dateKey.slice(-2));
            const total = day.orders + day.mps + day.production + day.actions;
            const isSelected = date === day.dateKey;
            return (
              <button
                key={day.dateKey}
                onClick={() => pushParams({ date: isSelected ? null : day.dateKey })}
                className={`rounded-lg border p-1 text-left transition-colors duration-150 ease-out ${
                  isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-surface-muted"
                } ${day.inMonth ? "" : "opacity-40"}`}
              >
                <p className="text-[11px] font-medium text-foreground">{dayNum}</p>
                {total > 0 && (
                  <p className="text-[9px] leading-tight text-muted-foreground">
                    {day.orders > 0 && `O${day.orders} `}
                    {day.mps > 0 && `M${day.mps} `}
                    {day.production > 0 && `P${day.production} `}
                    {day.actions > 0 && `A${day.actions}`}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input w-full sm:w-64"
          placeholder="Search keyword..."
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && pushParams({ keyword: keywordInput })}
        />
        <Button size="sm" variant="secondary" onClick={() => pushParams({ keyword: keywordInput })}>
          Search
        </Button>
        <select className="input w-44" value={section} onChange={(e) => pushParams({ section: e.target.value })}>
          {SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        {date && (
          <Button size="sm" variant="secondary" onClick={() => pushParams({ date: null })}>
            Clear date ({date})
          </Button>
        )}
      </div>

      {results.length === 0 ? (
        <EmptyState title="No matching records" description="Change the selected date, section, or search keyword above." />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-muted/40 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Section</th>
                  <th className="px-2 py-2 font-medium">Reference</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium">Area / Owner</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Risk / Priority</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                    <td className="px-2 py-2">
                      <Badge tone={SECTION_TONE[r.section]}>{r.section}</Badge>
                    </td>
                    <td className="px-2 py-2">
                      <a href={r.href} className="font-medium text-foreground hover:text-primary hover:underline">
                        {r.reference}
                      </a>
                    </td>
                    <td className="px-2 py-2 text-foreground">{r.description}</td>
                    <td className="px-2 py-2 text-muted-foreground">{r.areaOwner}</td>
                    <td className="px-2 py-2 text-muted-foreground">{r.status}</td>
                    <td className="px-2 py-2 text-muted-foreground">{r.riskPriority}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
