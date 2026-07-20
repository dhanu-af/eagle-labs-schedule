"use client";

import { Card } from "@/components/ui/Card";
import type { QcSampleRow } from "./qc-samples-client";

const REPORTS: { type: string; title: string; description: string }[] = [
  { type: "daily-collection", title: "Daily Sample Collection", description: "Samples collected today." },
  { type: "pending-testing", title: "Samples Pending Testing", description: "Currently in the laboratory phase." },
  { type: "approved", title: "Approved Samples", description: "Passed and moved to retention." },
  { type: "failed", title: "Failed Samples", description: "Rejected samples with remarks." },
  { type: "retention-inventory", title: "Retention Inventory", description: "Everything currently on the retention shelf." },
  { type: "retention-expiry", title: "Retention Expiry Report", description: "Retention samples by expiry/destroy date." },
  { type: "coa", title: "COA Report", description: "Samples with a certificate of analysis on file." },
  { type: "history-by-batch", title: "Sample History by Batch", description: "All samples, grouped by batch number." },
  { type: "qc-performance", title: "QC Performance (Turnaround)", description: "Time from lab receipt to test result." },
  { type: "monthly-summary", title: "Monthly Sample Summary", description: "Sample counts by month and status." },
];

export default function ReportsTab({ samples }: { samples: QcSampleRow[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Export any report to Excel. Reports run against all {samples.length} sample record{samples.length === 1 ? "" : "s"} currently in the system.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.type} padding="sm">
            <p className="text-sm font-semibold text-foreground">{r.title}</p>
            <p className="mb-3 text-xs text-muted-foreground">{r.description}</p>
            <a
              href={`/api/reports/qc-samples?type=${r.type}`}
              className="inline-flex rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
            >
              Export to Excel
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
