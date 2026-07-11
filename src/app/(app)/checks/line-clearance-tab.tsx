"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLineClearance, approveLineClearance, unlockCheckRecord } from "@/lib/actions/checks-actions";
import { toDateInputValue } from "@/lib/ui";
import type { LineClearanceRow } from "./checks-client";
import { STATUS_BADGE } from "./status-badge";
import { ExportButton } from "./export-button";
import { Field, Checkbox, SignatureField } from "./supervisor-preop-tab";

export default function LineClearanceTab({
  rows,
  canSubmit,
  canApproveSupervisor,
  canApproveQa,
  canUnlock,
}: {
  rows: LineClearanceRow[];
  canSubmit: boolean;
  canApproveSupervisor: boolean;
  canApproveQa: boolean;
  canUnlock: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [filterLine, setFilterLine] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () => (filterLine ? rows.filter((r) => r.line.toLowerCase().includes(filterLine.toLowerCase())) : rows),
    [rows, filterLine]
  );

  function approve(id: string, as: "SUPERVISOR" | "QA") {
    startTransition(async () => {
      await approveLineClearance(id, as);
      router.refresh();
    });
  }

  function unlock(id: string) {
    startTransition(async () => {
      await unlockCheckRecord("LINE_CLEARANCE", id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={filterLine}
          onChange={(e) => setFilterLine(e.target.value)}
          placeholder="Filter by line..."
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
        <div className="flex gap-2">
          <ExportButton type="clearance" />
          {canSubmit && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              + New Clearance
            </button>
          )}
        </div>
      </div>

      <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Line</th>
              <th className="px-3 py-2">Batch</th>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2">Label/Pkg</th>
              <th className="px-3 py-2">Equipment</th>
              <th className="px-3 py-2">Docs</th>
              <th className="px-3 py-2">Submitted By</th>
              <th className="px-3 py-2">Supervisor</th>
              <th className="px-3 py-2">QA</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                <td className="px-3 py-2 text-muted-foreground">{r.date.slice(0, 10)}</td>
                <td className="px-3 py-2 text-foreground">{r.line}</td>
                <td className="px-3 py-2">{r.previousBatchCleared ? "✅" : "❌"}</td>
                <td className="px-3 py-2">{r.materialCleared ? "✅" : "❌"}</td>
                <td className="px-3 py-2">{r.labelPackagingCleared ? "✅" : "❌"}</td>
                <td className="px-3 py-2">{r.equipmentCleared ? "✅" : "❌"}</td>
                <td className="px-3 py-2">{r.documentationVerified ? "✅" : "❌"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.submittedByName}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.supervisorApprovedByName ? (
                    `✓ ${r.supervisorApprovedByName}`
                  ) : canApproveSupervisor && !r.locked ? (
                    <button disabled={pending} onClick={() => approve(r.id, "SUPERVISOR")} className="text-info hover:opacity-80">
                      Approve
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.qaApprovedByName ? (
                    `✓ ${r.qaApprovedByName}`
                  ) : canApproveQa && !r.locked ? (
                    <button disabled={pending} onClick={() => approve(r.id, "QA")} className="text-info hover:opacity-80">
                      Approve
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">{STATUS_BADGE[r.status]}</td>
                <td className="px-3 py-2">
                  {r.locked && canUnlock && (
                    <button disabled={pending} onClick={() => unlock(r.id)} className="text-xs text-info hover:opacity-80">
                      Unlock
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No records match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <LineClearanceForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function LineClearanceForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createLineClearance({
          date: String(formData.get("date")),
          line: String(formData.get("line")),
          previousBatchCleared: formData.get("previousBatchCleared") === "on",
          materialCleared: formData.get("materialCleared") === "on",
          labelPackagingCleared: formData.get("labelPackagingCleared") === "on",
          equipmentCleared: formData.get("equipmentCleared") === "on",
          documentationVerified: formData.get("documentationVerified") === "on",
          comments: String(formData.get("comments") ?? ""),
          signature: String(formData.get("signature") ?? ""),
        });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Line Clearance</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input name="date" type="date" required defaultValue={toDateInputValue(new Date())} className="input" />
            </Field>
            <Field label="Line / Room">
              <input name="line" required placeholder="e.g. Blending Line 1" className="input" />
            </Field>
          </div>
          <Checkbox name="previousBatchCleared" label="Previous batch cleared" />
          <Checkbox name="materialCleared" label="Material clearance confirmed" />
          <Checkbox name="labelPackagingCleared" label="Label & packaging clearance confirmed" />
          <Checkbox name="equipmentCleared" label="Equipment clearance confirmed" />
          <Checkbox name="documentationVerified" label="Documentation verified" />
          <Field label="Comments">
            <textarea name="comments" rows={2} className="input" />
          </Field>
          <SignatureField />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Signing & Submitting..." : "Sign & Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
