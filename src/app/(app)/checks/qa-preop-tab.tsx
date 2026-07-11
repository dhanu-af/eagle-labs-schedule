"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQaPreOpCheck, unlockCheckRecord } from "@/lib/actions/checks-actions";
import { toDateInputValueUTC, todayInBrisbane, formatBrisbaneTime } from "@/lib/ui";
import type { QaPreOp } from "./checks-client";
import { STATUS_BADGE } from "./status-badge";
import { ExportButton } from "./export-button";
import { Field, Checkbox, SignatureField } from "./supervisor-preop-tab";

export default function QaPreOpTab({
  rows,
  canSubmit,
  canUnlock,
}: {
  rows: QaPreOp[];
  canSubmit: boolean;
  canUnlock: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [filterRoom, setFilterRoom] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filterRoom && !r.room.toLowerCase().includes(filterRoom.toLowerCase())) return false;
        if (filterDate && r.date.slice(0, 10) !== filterDate) return false;
        return true;
      }),
    [rows, filterRoom, filterDate]
  );

  function unlock(id: string) {
    startTransition(async () => {
      await unlockCheckRecord("QA_PREOP", id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            placeholder="Filter by room..."
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="flex gap-2">
          <ExportButton type="qa" />
          {canSubmit && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              + New Check
            </button>
          )}
        </div>
      </div>

      <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Room</th>
              <th className="px-3 py-2">Room Inspection</th>
              <th className="px-3 py-2">Equipment</th>
              <th className="px-3 py-2">GMP Compliance</th>
              <th className="px-3 py-2">Environmental</th>
              <th className="px-3 py-2">Submitted By</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                <td className="px-3 py-2 text-muted-foreground">{r.date.slice(0, 10)}</td>
                <td className="px-3 py-2 text-foreground">{r.room}</td>
                <td className="px-3 py-2">{r.qaRoomInspection ? "✅" : "❌"}</td>
                <td className="px-3 py-2">{r.equipmentVerification ? "✅" : "❌"}</td>
                <td className="px-3 py-2">{r.gmpCompliance ? "✅" : "❌"}</td>
                <td className="px-3 py-2">{r.environmentalCondition ? "✅" : "❌"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.submittedByName} <span className="text-xs">({r.submittedByRole.replace("_", " ")})</span>
                  <br />
                  <span className="text-xs">Signed {formatBrisbaneTime(r.submittedAt)}</span>
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
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No records match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <QaPreOpForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function QaPreOpForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createQaPreOpCheck({
          date: String(formData.get("date")),
          room: String(formData.get("room")),
          qaRoomInspection: formData.get("qaRoomInspection") === "on",
          equipmentVerification: formData.get("equipmentVerification") === "on",
          gmpCompliance: formData.get("gmpCompliance") === "on",
          environmentalCondition: formData.get("environmentalCondition") === "on",
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
          <h2 className="text-base font-semibold text-foreground">QA Pre-Operational Check</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input name="date" type="date" required defaultValue={toDateInputValueUTC(todayInBrisbane())} className="input" />
            </Field>
            <Field label="Room">
              <input name="room" required placeholder="e.g. Blending Room" className="input" />
            </Field>
          </div>
          <Checkbox name="qaRoomInspection" label="QA room inspection completed" />
          <Checkbox name="equipmentVerification" label="Equipment verification completed" />
          <Checkbox name="gmpCompliance" label="GMP compliance verified" />
          <Checkbox name="environmentalCondition" label="Environmental condition verified" />
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
