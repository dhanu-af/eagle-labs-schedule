"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePayRun, finalizePayRun, generatePayRun } from "@/lib/actions/payroll-actions";
import { toDateInputValue } from "@/lib/ui";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type Payslip = {
  id: string;
  employeeName: string;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number;
  grossPay: number;
};
type PayRun = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "FINALIZED";
  payslips: Payslip[];
};

export default function PayrollClient({
  canGenerate,
  payRuns,
}: {
  canGenerate: boolean;
  payRuns: PayRun[];
}) {
  const router = useRouter();
  const [showGenerate, setShowGenerate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll"
        subtitle="Pay runs generated from recorded attendance hours and overtime."
        actions={canGenerate && <Button onClick={() => setShowGenerate(true)}>+ Generate Pay Run</Button>}
      />

      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-foreground">
        <p className="font-semibold">⚠ Not yet compliance-reviewed</p>
        <p className="text-muted-foreground">
          Gross pay here is a straight <code>hours × rate</code> calculation (overtime at 1.5×) with
          no PAYG withholding, superannuation, or Fair Work award interpretation applied. Have your
          accountant or payroll specialist review this module before it&apos;s used to run real wages.
        </p>
      </div>

      <div className="space-y-3">
        {payRuns.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface">
            <EmptyState title="No pay runs yet." />
          </div>
        )}
        {payRuns.map((run) => {
          const total = run.payslips.reduce((s, p) => s + p.grossPay, 0);
          const isOpen = expanded === run.id;
          return (
            <Card key={run.id} padding="sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => setExpanded(isOpen ? null : run.id)}
                  className="text-left"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {run.periodStart} → {run.periodEnd}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {run.payslips.length} payslip(s) · ${total.toFixed(2)} total gross
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <Badge tone={run.status === "FINALIZED" ? "success" : "warning"}>{run.status}</Badge>
                  <a
                    href={`/api/reports/payroll?payRunId=${run.id}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted"
                  >
                    Export Excel
                  </a>
                  {canGenerate && run.status === "DRAFT" && (
                    <>
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await finalizePayRun(run.id);
                            router.refresh();
                          })
                        }
                      >
                        Finalize
                      </Button>
                      <button
                        disabled={pending}
                        onClick={() => {
                          if (!confirm("Delete this draft pay run?")) return;
                          startTransition(async () => {
                            await deletePayRun(run.id);
                            router.refresh();
                          });
                        }}
                        className="rounded-lg border border-danger/30 px-2 py-1 text-xs font-medium text-danger transition-colors duration-150 ease-out hover:bg-danger/10 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 overflow-x-auto border-t border-border pt-3">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1">Employee</th>
                        <th className="py-1">Regular hrs</th>
                        <th className="py-1">OT hrs</th>
                        <th className="py-1">Rate/hr</th>
                        <th className="py-1">Gross</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.payslips.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="py-1.5 text-foreground">{p.employeeName}</td>
                          <td className="py-1.5 text-muted-foreground">{p.regularHours}</td>
                          <td className="py-1.5 text-muted-foreground">{p.overtimeHours}</td>
                          <td className="py-1.5 text-muted-foreground">${p.hourlyRate.toFixed(2)}</td>
                          <td className="py-1.5 font-medium text-foreground">${p.grossPay.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} />}
    </div>
  );
}

function GenerateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = toDateInputValue(new Date());
  const weekAgo = toDateInputValue(new Date(Date.now() - 6 * 86400000));

  function submit(formData: FormData) {
    const start = String(formData.get("periodStart"));
    const end = String(formData.get("periodEnd"));
    startTransition(async () => {
      await generatePayRun(start, end);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Generate Pay Run</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Period start</span>
              <input name="periodStart" type="date" required defaultValue={weekAgo} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Period end</span>
              <input name="periodEnd" type="date" required defaultValue={today} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Pulls recorded attendance hours and overtime for all active employees within this range.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Generating..." : "Generate"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
