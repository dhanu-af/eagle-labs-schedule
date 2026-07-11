"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDailyTask,
  deleteDailyTask,
  duplicatePreviousDay,
  updateTaskStatus,
} from "@/lib/actions/daily-actions";
import { PRIORITY_CLASS, PRIORITY_LABEL, STATUS_CLASS, STATUS_LABEL, toDateInputValue } from "@/lib/ui";
import DailyKanban from "./daily-kanban";
import EditTaskModal, { Field } from "./task-edit-modal";

export type Team = { id: string; name: string };
export type Employee = { id: string; name: string; teamId: string };
export type Task = {
  id: string;
  teamId: string;
  teamName: string;
  employeeId: string | null;
  employeeName: string | null;
  product: string;
  batchNo: string | null;
  process: string;
  targetQty: number | null;
  targetUnit: string;
  actualQty: number;
  plannedStart: string | null;
  plannedFinish: string | null;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "NOT_STARTED" | "RUNNING" | "COMPLETED" | "DELAYED";
  delayReason: string | null;
  notes: string | null;
};

const STATUS_OPTIONS = ["NOT_STARTED", "RUNNING", "COMPLETED", "DELAYED"] as const;
const PRIORITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export default function DailyPlannerClient({
  dateStr,
  teams,
  employees,
  tasks,
  canManage,
}: {
  dateStr: string;
  teams: Team[];
  employees: Employee[];
  tasks: Task[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [pending, startTransition] = useTransition();

  const filteredTasks = useMemo(
    () => (teamFilter === "ALL" ? tasks : tasks.filter((t) => t.teamId === teamFilter)),
    [tasks, teamFilter]
  );

  function changeDate(newDate: string) {
    router.push(`/daily?date=${newDate}`);
  }

  function shiftDate(days: number) {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    changeDate(toDateInputValue(d));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Daily Production Planner</h1>
          <p className="text-sm text-muted-foreground">
            Assign products, batches, targets and track live status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground hover:bg-surface-muted"
          >
            ←
          </button>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => changeDate(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          />
          <button
            onClick={() => shiftDate(1)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground hover:bg-surface-muted"
          >
            →
          </button>
          {canManage && (
            <>
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await duplicatePreviousDay(dateStr);
                    router.refresh();
                  })
                }
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-60"
              >
                Duplicate previous day
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                + Add Task
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <FilterPill active={teamFilter === "ALL"} onClick={() => setTeamFilter("ALL")}>
            All Teams
          </FilterPill>
          {teams.map((t) => (
            <FilterPill key={t.id} active={teamFilter === t.id} onClick={() => setTeamFilter(t.id)}>
              {t.name}
            </FilterPill>
          ))}
        </div>
        <div className="flex rounded-lg border border-border bg-surface p-0.5">
          <button
            onClick={() => setView("kanban")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <DailyKanban tasks={filteredTasks} employees={employees} canManage={canManage} />
      ) : (
        <div className="space-y-3">
          {filteredTasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
              No tasks scheduled for this date.
            </div>
          )}
          {filteredTasks.map((t) => (
            <TaskRow key={t.id} task={t} employees={employees} canManage={canManage} />
          ))}
        </div>
      )}

      {showModal && (
        <AddTaskModal
          dateStr={dateStr}
          teams={teams}
          employees={employees}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function TaskRow({
  task,
  employees,
  canManage,
}: {
  task: Task;
  employees: Employee[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(task.status);
  const [delayReason, setDelayReason] = useState(task.delayReason ?? "");
  const [actualQty, setActualQty] = useState(task.actualQty);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  function save() {
    startTransition(async () => {
      await updateTaskStatus(task.id, status, delayReason, actualQty);
      setDirty(false);
    });
  }

  function remove() {
    if (!confirm(`Delete "${task.product} · ${task.process}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteDailyTask(task.id);
      router.refresh();
    });
  }

  return (
    <div className="card-shadow rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {task.teamName}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASS[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
          </div>
          <p className="mt-1 font-medium text-foreground">
            {task.product} · {task.process}
            {task.batchNo ? ` · Batch ${task.batchNo}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {task.employeeName ?? "Unassigned"}
            {task.plannedStart ? ` · ${task.plannedStart}–${task.plannedFinish ?? "?"}` : ""}
          </p>
          {task.notes && <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[task.status]}`}>
            {STATUS_LABEL[task.status]}
          </span>
          {canManage && (
            <>
              <button
                onClick={() => setShowEdit(true)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                aria-label="Edit task"
              >
                Edit
              </button>
              <button
                onClick={remove}
                disabled={pending}
                className="text-xs font-medium text-muted-foreground hover:text-danger"
                aria-label="Delete task"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {task.targetQty !== null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>
              {actualQty}/{task.targetQty} {task.targetUnit}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.round((actualQty / task.targetQty) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as Task["status"]);
              setDirty(true);
            }}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {task.targetQty !== null && (
            <input
              type="number"
              value={actualQty}
              onChange={(e) => {
                setActualQty(Number(e.target.value));
                setDirty(true);
              }}
              className="w-24 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
              placeholder="Actual"
            />
          )}
          {status === "DELAYED" && (
            <input
              type="text"
              value={delayReason}
              onChange={(e) => {
                setDelayReason(e.target.value);
                setDirty(true);
              }}
              placeholder="Delay reason"
              className="min-w-[160px] flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
            />
          )}
          {dirty && (
            <button
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      )}

      {showEdit && (
        <EditTaskModal task={task} employees={employees} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}

function AddTaskModal({
  dateStr,
  teams,
  employees,
  onClose,
}: {
  dateStr: string;
  teams: Team[];
  employees: Employee[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const teamEmployees = employees.filter((e) => e.teamId === teamId);

  function submit(formData: FormData) {
    startTransition(async () => {
      await createDailyTask(formData);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Add Daily Task</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <input type="hidden" name="date" value={dateStr} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Team">
              <select
                name="teamId"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Operator">
              <select
                name="employeeId"
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product">
              <input name="product" required className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
            <Field label="Batch No">
              <input name="batchNo" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
          </div>
          <Field label="Process">
            <input name="process" required placeholder="e.g. Test Batch, Full Batch, Encapsulation" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Target Qty">
              <input name="targetQty" type="number" step="0.1" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
            <Field label="Unit">
              <input name="targetUnit" defaultValue="kg" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
            <Field label="Priority">
              <select name="priority" defaultValue="MEDIUM" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground">
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
              <input name="plannedStart" type="time" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
            <Field label="Planned Finish">
              <input name="plannedFinish" type="time" className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={2} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving..." : "Add Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
