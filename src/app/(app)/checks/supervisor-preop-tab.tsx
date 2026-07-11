"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupervisorPreOpCheck, unlockCheckRecord } from "@/lib/actions/checks-actions";
import { toDateInputValue } from "@/lib/ui";
import type { SupervisorPreOp } from "./checks-client";
import { STATUS_BADGE } from "./status-badge";
import { ExportButton } from "./export-button";

export default function SupervisorPreOpTab({
  rows,
  canSubmit,
  canUnlock,
}: {
  rows: SupervisorPreOp[];
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
      await unlockCheckRecord("SUPERVISOR_PREOP", id);
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
          <ExportButton type="supervisor" />
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
              <th className="px-3 py-2">Cleanliness</th>
              <th className="px-3 py-2">Equipment</th>
              <th className="px-3 py-2">Safety/PPE</th>
              <th className="px-3 py-2">Calibration</th>
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
                <td className="px-3 py-2">{r.roomCleanliness ? "✅" : "❌"}</td>
                <td className="px-3 py-2">{r.equipmentReadiness ? "✅" : "❌"}</td>
                <td className="px-3 py-2">{r.safetyPpeVerified ? "✅" : "❌"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.calibrationStatus ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.submittedByName} <span className="text-xs">({r.submittedByRole.replace("_", " ")})</span>
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Supervisor Pre-Operational Check</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input name="date" type="date" required defaultValue={toDateInputValue(new Date())} className="input" />
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
