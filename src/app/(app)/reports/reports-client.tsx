"use client";

import { useState } from "react";
import { toDateInputValue } from "@/lib/ui";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

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
      <PageHeader title="Reports" subtitle="Export data as Excel (.xlsx) for a date range." />

      <Card padding="sm" className="flex flex-wrap items-center gap-3">
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
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.key} padding="sm">
            <p className="text-sm font-semibold text-foreground">{r.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
            <a
              href={`/api/reports/${r.key}?start=${start}&end=${end}`}
              className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-150 ease-out hover:opacity-90 active:scale-[0.98]"
            >
              Download Excel
            </a>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Payroll payslip exports are available from the Payroll page, per pay run.
      </p>
    </div>
  );
}
