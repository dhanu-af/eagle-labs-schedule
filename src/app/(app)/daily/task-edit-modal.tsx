"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDailyTask } from "@/lib/actions/daily-actions";
import { PRIORITY_LABEL } from "@/lib/ui";
import type { Employee, Task } from "./daily-client";
import { Button } from "@/components/ui/Button";

const PRIORITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default function EditTaskModal({
  task,
  employees,
  onClose,
}: {
  task: Task;
  employees: Employee[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const teamEmployees = employees.filter((e) => e.teamId === task.teamId);

  function submit(formData: FormData) {
    startTransition(async () => {
      await updateDailyTask(task.id, formData);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Edit Task</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Operator">
              <select
                name="employeeId"
                defaultValue={task.employeeId ?? ""}
                className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">Unassigned</option>
                {teamEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Batch No">
              <input name="batchNo" defaultValue={task.batchNo ?? ""} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product">
              <input name="product" required defaultValue={task.product} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
            <Field label="Process">
              <input name="process" required defaultValue={task.process} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Target Qty">
              <input name="targetQty" type="number" step="0.1" defaultValue={task.targetQty ?? ""} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
            <Field label="Unit">
              <input name="targetUnit" defaultValue={task.targetUnit} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
            <Field label="Priority">
              <select name="priority" defaultValue={task.priority} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground">
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Planned Start">
              <input name="plannedStart" type="time" defaultValue={task.plannedStart ?? ""} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
            <Field label="Planned Finish">
              <input name="plannedFinish" type="time" defaultValue={task.plannedFinish ?? ""} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={2} defaultValue={task.notes ?? ""} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
