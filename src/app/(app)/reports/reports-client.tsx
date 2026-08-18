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

const LOGIN_HISTORY_REPORT: ReportDef = {
  key: "login-history",
  label: "Login History Report",
  description: "Who logged in, when, and from what device, in range.",
};

const CHECKS_REPORTS: { type: string; label: string }[] = [
  { type: "supervisor", label: "Supervisor Pre-Op" },
  { type: "qa", label: "QA Pre-Op" },
  { type: "environmental", label: "RH & Temperature" },
  { type: "clearance", label: "Line Clearance" },
  { type: "postop", label: "Post-Op Checks" },
  { type: "worklog", label: "Work Log" },
];

export default function ReportsClient({ canViewLoginHistory }: { canViewLoginHistory: boolean }) {
  const today = toDateInputValue(new Date());
  const weekAgo = toDateInputValue(new Date(Date.now() - 6 * 86400000));
  const [start, setStart] = useState(weekAgo);
  const [end, setEnd] = useState(today);
  const reports = canViewLoginHistory ? [...REPORTS, LOGIN_HISTORY_REPORT] : REPORTS;

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
        {reports.map((r) => (
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

      <Card padding="sm">
        <p className="text-sm font-semibold text-foreground">Checks Reports</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Full history for each check type (these aren&apos;t limited by the date range above).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHECKS_REPORTS.map((c) => (
            <a
              key={c.type}
              href={`/api/reports/checks?type=${c.type}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted"
            >
              {c.label}
            </a>
          ))}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Payroll payslip exports are available from the Payroll page, per pay run. Mfg Reconciliation&apos;s PDF report is
        per-batch, not date-range — download it from that batch&apos;s own detail page.
      </p>
    </div>
  );
}
