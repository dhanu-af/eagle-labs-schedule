"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { sendQcSummaryToWhatsApp } from "@/lib/actions/qc-sample-actions";
import { generateQcSummaryReportText } from "@/lib/generate-qc-summary-report";
import type { QcSampleRow, WhatsAppGroupOption } from "./qc-samples-client";

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

export default function ReportsTab({ samples, whatsAppGroups }: { samples: QcSampleRow[]; whatsAppGroups: WhatsAppGroupOption[] }) {
  return (
    <div className="space-y-4">
      <QcSummaryWhatsAppSection samples={samples} whatsAppGroups={whatsAppGroups} />

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

function QcSummaryWhatsAppSection({
  samples,
  whatsAppGroups,
}: {
  samples: QcSampleRow[];
  whatsAppGroups: WhatsAppGroupOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [sendMode, setSendMode] = useState<"group" | "number">("group");
  const [groupId, setGroupId] = useState(whatsAppGroups[0]?.id ?? "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sendResult, setSendResult] = useState("");
  const [error, setError] = useState("");

  const reportText = useMemo(() => generateQcSummaryReportText(samples), [samples]);

  function send() {
    setError("");
    setSendResult("");
    startTransition(async () => {
      try {
        const result = await sendQcSummaryToWhatsApp(
          sendMode === "group" ? { groupId, phoneNumber: null } : { groupId: null, phoneNumber }
        );
        setSendResult(
          result.sent
            ? `Sent to "${result.target}" via WhatsApp.`
            : `Sent to "${result.target}" (recorded in Audit Trail — WhatsApp isn't connected yet, so no real message went out).`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send report.");
      }
    });
  }

  const canSend = sendMode === "group" ? !!groupId : phoneNumber.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">QC Summary Report</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">
            <button
              onClick={() => setSendMode("group")}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors duration-150 ease-out ${
                sendMode === "group" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Group
            </button>
            <button
              onClick={() => setSendMode("number")}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors duration-150 ease-out ${
                sendMode === "number" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Number
            </button>
          </div>
          {sendMode === "group" ? (
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="input py-1 text-xs">
              {whatsAppGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Phone number or wa.me link"
              className="input py-1 text-xs"
            />
          )}
          <Button size="sm" onClick={send} disabled={pending || !canSend}>
            {pending ? "Sending..." : "Send to WhatsApp"}
          </Button>
        </div>
      </div>
      {sendResult && <p className="text-xs text-success">{sendResult}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
      <Card padding="md">
        <pre className="whitespace-pre-wrap text-xs text-foreground">{reportText}</pre>
      </Card>
    </div>
  );
}
