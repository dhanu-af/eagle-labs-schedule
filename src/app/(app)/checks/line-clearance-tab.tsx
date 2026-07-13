"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLineClearance, approveLineClearance, unlockCheckRecord, deleteCheckRecord } from "@/lib/actions/checks-actions";
import { toDateInputValueUTC, todayInBrisbane, formatBrisbaneTime } from "@/lib/ui";
import type { LineClearanceRow } from "./checks-client";
import { STATUS_BADGE } from "./status-badge";
import { ExportButton } from "./export-button";
import { groupRecordsByPeriod } from "./group-records";
import { GroupToggle, GroupHeaderRow } from "./group-toggle";
import { Field, Checkbox, SignatureField } from "./supervisor-preop-tab";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

export default function LineClearanceTab({
  rows,
  canSubmit,
  canApproveSupervisor,
  canApproveQa,
  canUnlock,
  canDelete,
}: {
  rows: LineClearanceRow[];
  canSubmit: boolean;
  canApproveSupervisor: boolean;
  canApproveQa: boolean;
  canUnlock: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [filterLine, setFilterLine] = useState("");
  const [view, setView] = useState<"day" | "week">("day");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () => (filterLine ? rows.filter((r) => r.line.toLowerCase().includes(filterLine.toLowerCase())) : rows),
    [rows, filterLine]
  );

  const groups = useMemo(() => groupRecordsByPeriod(filtered, (r) => r.date, view), [filtered, view]);

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

  function remove(id: string) {
    if (!confirm("Delete this check record? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteCheckRecord("LINE_CLEARANCE", id);
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
        <div className="flex items-center gap-2">
          <GroupToggle view={view} onChange={setView} />
          <ExportButton type="clearance" />
          {canSubmit && <Button onClick={() => setShowForm(true)}>+ New Clearance</Button>}
        </div>
      </div>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full min-w-[1500px] text-sm">
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <Th>Date</Th>
              <Th>Line</Th>
              <Th>Previous Product</Th>
              <Th>Previous Batch</Th>
              <Th>Batch</Th>
              <Th>Material</Th>
              <Th>Label/Pkg</Th>
              <Th>Equipment</Th>
              <Th>Docs</Th>
              <Th>Submitted By</Th>
              <Th>Supervisor</Th>
              <Th>QA</Th>
              <Th>Status</Th>
              <Th>Comments</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                <GroupHeaderRow colSpan={15} label={g.label} count={g.rows.length} />
                {g.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 transition-colors duration-150 ease-out even:bg-surface-muted/30 hover:bg-surface-muted/60">
                    <td className="px-3 py-2.5 text-muted-foreground">{r.date.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 text-foreground">{r.line}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.previousProductName ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.previousBatchNumber ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.previousBatchCleared ? "✅" : "❌"}</td>
                    <td className="px-3 py-2.5">{r.materialCleared ? "✅" : "❌"}</td>
                    <td className="px-3 py-2.5">{r.labelPackagingCleared ? "✅" : "❌"}</td>
                    <td className="px-3 py-2.5">{r.equipmentCleared ? "✅" : "❌"}</td>
                    <td className="px-3 py-2.5">{r.documentationVerified ? "✅" : "❌"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.submittedByName}
                      <br />
                      <span className="text-xs">Signed {formatBrisbaneTime(r.submittedAt)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.supervisorApprovedByName ? (
                        <>
                          ✓ {r.supervisorApprovedByName}
                          <br />
                          {r.supervisorApprovedAt && `Signed ${formatBrisbaneTime(r.supervisorApprovedAt)}`}
                        </>
                      ) : canApproveSupervisor && !r.locked ? (
                        <button disabled={pending} onClick={() => approve(r.id, "SUPERVISOR")} className="font-medium text-info transition-colors duration-150 ease-out hover:opacity-80">
                          Approve
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.qaApprovedByName ? (
                        <>
                          ✓ {r.qaApprovedByName}
                          <br />
                          {r.qaApprovedAt && `Signed ${formatBrisbaneTime(r.qaApprovedAt)}`}
                        </>
                      ) : canApproveQa && !r.locked ? (
                        <button disabled={pending} onClick={() => approve(r.id, "QA")} className="font-medium text-info transition-colors duration-150 ease-out hover:opacity-80">
                          Approve
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5">{STATUS_BADGE[r.status]}</td>
                    <td className="max-w-[200px] px-3 py-2.5 text-xs text-muted-foreground">{r.comments ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {r.locked && canUnlock && (
                          <button disabled={pending} onClick={() => unlock(r.id)} className="text-xs font-medium text-info transition-colors duration-150 ease-out hover:opacity-80">
                            Unlock
                          </button>
                        )}
                        {canDelete && (
                          <button disabled={pending} onClick={() => remove(r.id)} className="text-xs font-medium text-danger transition-colors duration-150 ease-out hover:opacity-80">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={15}>
                  <EmptyState title="No records match these filters." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

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
          previousProductName: String(formData.get("previousProductName") ?? ""),
          previousBatchNumber: String(formData.get("previousBatchNumber") ?? ""),
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
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Line Clearance</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input name="date" type="date" required defaultValue={toDateInputValueUTC(todayInBrisbane())} className="input" />
            </Field>
            <Field label="Line / Room">
              <input name="line" required placeholder="e.g. Blending Line 1" className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Previous Product Name">
              <input name="previousProductName" placeholder="e.g. Gut AU" className="input" />
            </Field>
            <Field label="Previous Batch Number">
              <input name="previousBatchNumber" placeholder="e.g. B12345" className="input" />
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
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Signing & Submitting..." : "Sign & Submit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
