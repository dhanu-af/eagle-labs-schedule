"use client";

import { useState } from "react";
import { toDateInputValue } from "@/lib/ui";

type ReportDef = { key: string; label: string; description: string };

const REPORTS: ReportDef[] = [
  { key: "daily", label: "Daily Production Report", description: "Every scheduled task, status and delay reason in range." },
  { key: "attendance", label: "Attendance Report", description: "Attendance status, hours worked and overtime per employee." },
  { key: "kpi", label: "KPI Report", description: "Daily KPI actuals vs targets across all teams." },
];

export default function ReportsClient() {
  const today = toDateInputValue(new Date());
  const weekAgo = toDateInputValue(new Date(Date.now() - 6 * 86400000));
  const [start, setStart] = useState(weekAgo);
  const [end, setEnd] = useState(today);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Export data as Excel (.xlsx) for a date range.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 card-shadow rounded-2xl border border-border bg-surface p-4">
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
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.key} className="card-shadow rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-foreground">{r.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
            <a
              href={`/api/reports/${r.key}?start=${start}&end=${end}`}
              className="mt-3 inline-block rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Download Excel
            </a>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Payroll payslip exports are available from the Payroll page, per pay run.
      </p>
    </div>
  );
}
