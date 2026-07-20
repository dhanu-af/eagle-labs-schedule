"use client";

import { Card } from "@/components/ui/Card";
import {
  daysUntil,
  IN_LAB_STATUSES,
  LAB_TESTING_OVERDUE_DAYS,
  LOW_QUANTITY_THRESHOLD,
  RETENTION_EXPIRY_WARNING_DAYS,
} from "@/lib/qc-sample-defaults";
import type { QcSampleRow } from "./qc-samples-client";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card interactive padding="sm">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

type Alert = { text: string; sampleId: string };

export default function DashboardTab({
  samples,
  onSelect,
}: {
  samples: QcSampleRow[];
  onSelect: (id: string) => void;
}) {
  const awaitingCollection = samples.filter((s) => s.status === "WAITING_COLLECTION").length;
  const collectedToday = samples.filter((s) => s.collectionDate && isToday(s.collectionDate)).length;
  const sentToLab = samples.filter((s) => s.status === "WAITING_LAB").length;
  const underTesting = samples.filter((s) => IN_LAB_STATUSES.includes(s.status)).length;
  const approved = samples.filter((s) => s.status === "APPROVED" || s.status === "RETENTION").length;
  const failed = samples.filter((s) => s.status === "REJECTED").length;
  const retentionSamples = samples.filter((s) => s.status === "RETENTION").length;
  const retentionExpired = samples.filter((s) => s.status === "EXPIRED").length;

  const alerts: Alert[] = [];
  for (const s of samples) {
    if (s.status === "RETENTION" && s.retentionRecord?.expiryDate) {
      const days = daysUntil(s.retentionRecord.expiryDate);
      if (days !== null && days >= 0 && days <= RETENTION_EXPIRY_WARNING_DAYS) {
        alerts.push({ text: `${s.sampleId} — retention sample expires in ${days} day${days === 1 ? "" : "s"}`, sampleId: s.id });
      } else if (days !== null && days < 0) {
        alerts.push({ text: `${s.sampleId} — destroy retention sample (expired)`, sampleId: s.id });
      }
    }
    if (s.status === "WAITING_COLLECTION") {
      alerts.push({ text: `${s.sampleId} — waiting collection`, sampleId: s.id });
    }
    if (s.status === "WAITING_LAB") {
      alerts.push({ text: `${s.sampleId} — waiting for QC to receive at lab`, sampleId: s.id });
    }
    if (IN_LAB_STATUSES.includes(s.status) && s.receivedDate) {
      const daysInLab = -(daysUntil(s.receivedDate) ?? 0);
      if (daysInLab > LAB_TESTING_OVERDUE_DAYS) {
        alerts.push({ text: `${s.sampleId} — lab testing overdue (${daysInLab} days)`, sampleId: s.id });
      }
    }
    const coaItem = s.labTest?.items.find((it) => it.parameter === "COA Upload");
    if ((s.status === "APPROVED" || s.status === "RETENTION") && !coaItem?.details && !coaItem?.result) {
      alerts.push({ text: `${s.sampleId} — missing COA`, sampleId: s.id });
    }
    if (s.status === "RETENTION" && s.retentionRecord?.quantityRemaining !== null && s.retentionRecord && s.retentionRecord.quantityRemaining! < LOW_QUANTITY_THRESHOLD) {
      alerts.push({ text: `${s.sampleId} — retention quantity running low (${s.retentionRecord.quantityRemaining} ${s.unit})`, sampleId: s.id });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Live Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Awaiting Collection" value={awaitingCollection} />
          <StatCard label="Collected Today" value={collectedToday} />
          <StatCard label="Sent to Laboratory" value={sentToLab} />
          <StatCard label="Under Testing" value={underTesting} />
          <StatCard label="Approved" value={approved} />
          <StatCard label="Failed" value={failed} />
          <StatCard label="Retention Samples" value={retentionSamples} />
          <StatCard label="Retention Expired" value={retentionExpired} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No alerts right now.</p>
        ) : (
          <Card padding="sm">
            <ul className="divide-y divide-border text-sm">
              {alerts.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-foreground">{a.text}</span>
                  <button
                    onClick={() => onSelect(a.sampleId)}
                    className="text-xs font-medium text-primary hover:opacity-80"
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
