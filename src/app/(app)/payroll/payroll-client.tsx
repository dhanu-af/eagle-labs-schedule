"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePayRun, finalizePayRun, generatePayRun } from "@/lib/actions/payroll-actions";
import { toDateInputValue } from "@/lib/ui";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            Pay runs generated from recorded attendance hours and overtime.
          </p>
        </div>
        {canGenerate && (
          <button
            onClick={() => setShowGenerate(true)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + Generate Pay Run
          </button>
        )}
      </div>

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
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            No pay runs yet.
          </div>
        )}
        {payRuns.map((run) => {
          const total = run.payslips.reduce((s, p) => s + p.grossPay, 0);
          const isOpen = expanded === run.id;
          return (
            <div key={run.id} className="card-shadow rounded-2xl border border-border bg-surface p-4">
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
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      run.status === "FINALIZED"
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-warning/30 bg-warning/10 text-warning"
                    }`}
                  >
                    {run.status}
                  </span>
                  <a
                    href={`/api/reports/payroll?payRunId=${run.id}`}
                    className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                  >
                    Export Excel
                  </a>
                  {canGenerate && run.status === "DRAFT" && (
                    <>
                      <button
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await finalizePayRun(run.id);
                            router.refresh();
                          })
                        }
                        className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      >
                        Finalize
                      </button>
                      <button
                        disabled={pending}
                        onClick={() => {
                          if (!confirm("Delete this draft pay run?")) return;
                          startTransition(async () => {
                            await deletePayRun(run.id);
                            router.refresh();
                          });
                        }}
                        className="rounded-lg border border-danger/30 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-60"
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
            </div>
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
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Generate Pay Run</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
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
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
