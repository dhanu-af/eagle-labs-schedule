"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMachine, updateMachine, addCapacityException, deleteCapacityException } from "@/lib/actions/capacity-planning-actions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MachineRow } from "./capacity-planning-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ExceptionsPanel({ machine }: { machine: MachineRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function add() {
    setError("");
    if (!date || hours === "") return setError("Date and available hours are required.");
    startTransition(async () => {
      try {
        await addCapacityException(machine.id, { date, hoursAvailableOverride: Number(hours), reason: reason || null });
        setDate("");
        setHours("");
        setReason("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteCapacityException(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove.");
      }
    });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Capacity Overrides (maintenance, holidays — 0h for a full day down)</p>
      {machine.capacityExceptions.length === 0 ? (
        <p className="mb-2 text-xs text-muted-foreground">None set — uses the standard {machine.standardHoursPerDay}h/day.</p>
      ) : (
        <ul className="mb-2 space-y-1 text-xs">
          {machine.capacityExceptions.map((e) => (
            <li key={e.id} className="flex items-center justify-between">
              <span>
                {new Date(e.date).toLocaleDateString()} — {e.hoursAvailableOverride}h{e.reason ? ` (${e.reason})` : ""}
              </span>
              <button onClick={() => remove(e.id)} disabled={pending} className="text-danger hover:underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="number" className="input" placeholder="Hours available" value={hours} onChange={(e) => setHours(e.target.value)} />
        <input className="input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="secondary" onClick={add} disabled={pending}>
          Add Override
        </Button>
      </div>
    </div>
  );
}

function MachineModal({ machine, onClose }: { machine: MachineRow | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [code, setCode] = useState(machine?.code ?? "");
  const [name, setName] = useState(machine?.name ?? "");
  const [workCenter, setWorkCenter] = useState(machine?.workCenter ?? "");
  const [standardHoursPerDay, setStandardHoursPerDay] = useState(String(machine?.standardHoursPerDay ?? 8));
  const [notes, setNotes] = useState(machine?.notes ?? "");
  const [active, setActive] = useState(machine?.active ?? true);

  function save() {
    setError("");
    if (!code.trim() || !name.trim()) return setError("Code and name are required.");
    const hours = Number(standardHoursPerDay);
    if (!hours || hours <= 0) return setError("Standard hours per day must be greater than 0.");

    startTransition(async () => {
      try {
        const data = { code, name, workCenter: workCenter || null, standardHoursPerDay: hours, notes: notes || null };
        if (machine) await updateMachine(machine.id, { ...data, active });
        else await createMachine(data);
        router.refresh();
        if (!machine) onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save machine.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{machine ? "Edit Machine" : "New Machine"}</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Code">
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Work Center">
              <input className="input" placeholder="Blending / Encapsulation..." value={workCenter} onChange={(e) => setWorkCenter(e.target.value)} />
            </Field>
            <Field label="Standard Hours / Day">
              <input type="number" className="input" value={standardHoursPerDay} onChange={(e) => setStandardHoursPerDay(e.target.value)} />
            </Field>
            {machine && (
              <Field label="Status">
                <select className="input" value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            )}
          </div>
          <Field label="Notes">
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>

          {machine && <ExceptionsPanel machine={machine} />}
        </div>
      </div>
    </div>
  );
}

export default function MachinesTab({ machines, canManage }: { machines: MachineRow[]; canManage: boolean }) {
  const [editing, setEditing] = useState<MachineRow | null | "new">(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            + New Machine
          </Button>
        )}
      </div>

      {machines.length === 0 ? (
        <EmptyState title="No machines yet" description="Add the real machines/lines in this factory (e.g. Capsule Machine, V Blender 1) to start capacity planning." />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={THEAD_ROW_CLASS}>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th>Work Center</Th>
                  <Th>Standard Hours/Day</Th>
                  <Th>Overrides</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id} onClick={() => canManage && setEditing(m)} className={`border-b border-border last:border-0 ${canManage ? "cursor-pointer hover:bg-surface-muted/40" : ""}`}>
                    <td className="px-3 py-2 font-medium text-foreground">{m.code}</td>
                    <td className="px-3 py-2">{m.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.workCenter ?? "—"}</td>
                    <td className="px-3 py-2">{m.standardHoursPerDay}h</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.capacityExceptions.length}</td>
                    <td className="px-3 py-2">
                      <Badge tone={m.active ? "success" : "muted"}>{m.active ? "Active" : "Inactive"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && <MachineModal machine={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
