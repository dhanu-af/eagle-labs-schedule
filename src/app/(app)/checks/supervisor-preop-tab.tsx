"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupervisorPreOpCheck, unlockCheckRecord, deleteCheckRecord } from "@/lib/actions/checks-actions";
import { toDateInputValueUTC, todayInBrisbane, formatBrisbaneTime } from "@/lib/ui";
import type { SupervisorPreOp } from "./checks-client";
import { STATUS_BADGE } from "./status-badge";
import { ExportButton } from "./export-button";
import { groupRecordsByPeriod } from "./group-records";
import { GroupToggle, GroupHeaderRow } from "./group-toggle";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

export default function SupervisorPreOpTab({
  rows,
  canSubmit,
  canUnlock,
  canDelete,
}: {
  rows: SupervisorPreOp[];
  canSubmit: boolean;
  canUnlock: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [filterRoom, setFilterRoom] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [view, setView] = useState<"day" | "week">("day");
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

  const groups = useMemo(() => groupRecordsByPeriod(filtered, (r) => r.date, view), [filtered, view]);

  function unlock(id: string) {
    startTransition(async () => {
      await unlockCheckRecord("SUPERVISOR_PREOP", id);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this check record? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteCheckRecord("SUPERVISOR_PREOP", id);
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
        <div className="flex items-center gap-2">
          <GroupToggle view={view} onChange={setView} />
          <ExportButton type="supervisor" />
          {canSubmit && <Button onClick={() => setShowForm(true)}>+ New Check</Button>}
        </div>
      </div>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <Th>Date</Th>
              <Th>Room</Th>
              <Th>Cleanliness</Th>
              <Th>Equipment</Th>
              <Th>Safety/PPE</Th>
              <Th>Calibration</Th>
              <Th>Submitted By</Th>
              <Th>Status</Th>
              <Th>Comments</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                <GroupHeaderRow colSpan={10} label={g.label} count={g.rows.length} />
                {g.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 transition-colors duration-150 ease-out even:bg-surface-muted/30 hover:bg-surface-muted/60">
                    <td className="px-3 py-2.5 text-muted-foreground">{r.date.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 text-foreground">{r.room}</td>
                    <td className="px-3 py-2.5">{r.roomCleanliness ? "✅" : "❌"}</td>
                    <td className="px-3 py-2.5">{r.equipmentReadiness ? "✅" : "❌"}</td>
                    <td className="px-3 py-2.5">{r.safetyPpeVerified ? "✅" : "❌"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.calibrationStatus ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.submittedByName} <span className="text-xs">({r.submittedByRole.replace("_", " ")})</span>
                      <br />
                      <span className="text-xs">Signed {formatBrisbaneTime(r.submittedAt)}</span>
                    </td>
                    <td className="px-3 py-2.5">{STATUS_BADGE[r.status]}</td>
                    <td className="max-w-[220px] px-3 py-2.5 text-xs text-muted-foreground">{r.comments ?? "—"}</td>
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
                <td colSpan={10}>
                  <EmptyState title="No records match these filters." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showForm && <SupervisorPreOpForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function SupervisorPreOpForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createSupervisorPreOpCheck({
          date: String(formData.get("date")),
          room: String(formData.get("room")),
          roomCleanliness: formData.get("roomCleanliness") === "on",
          equipmentReadiness: formData.get("equipmentReadiness") === "on",
          safetyPpeVerified: formData.get("safetyPpeVerified") === "on",
          calibrationStatus: String(formData.get("calibrationStatus") ?? ""),
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
          <h2 className="text-base font-semibold text-foreground">Supervisor Pre-Operational Check</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
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
          <Checkbox name="roomCleanliness" label="Room cleanliness verified" />
          <Checkbox name="equipmentReadiness" label="Equipment readiness confirmed" />
          <Checkbox name="safetyPpeVerified" label="Safety &amp; PPE verified" />
          <Field label="Calibration Status">
            <input name="calibrationStatus" placeholder="e.g. All instruments in calibration" className="input" />
          </Field>
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input name={name} type="checkbox" className="h-4 w-4 rounded border-border accent-[var(--primary)]" />
      {label}
    </label>
  );
}

export function SignatureField() {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <Field label="Digital Signature — type your full name to sign this record">
        <input name="signature" required placeholder="Type your full name" className="input" />
      </Field>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Your name, role, and the current date/time are recorded automatically as your signature at the moment you submit.
      </p>
    </div>
  );
}
