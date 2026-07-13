"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult,
} from "@hello-pangea/dnd";
import { updateTaskStatus, deleteDailyTask } from "@/lib/actions/daily-actions";
import { PRIORITY_CLASS, PRIORITY_LABEL, STATUS_LABEL, initials } from "@/lib/ui";
import type { Employee, Task } from "./daily-client";
import EditTaskModal from "./task-edit-modal";

const COLUMNS: { key: Task["status"]; label: string; tint: string }[] = [
  { key: "NOT_STARTED", label: "Not Started", tint: "var(--muted-foreground)" },
  { key: "RUNNING", label: "Running", tint: "var(--info)" },
  { key: "COMPLETED", label: "Completed", tint: "var(--success)" },
  { key: "DELAYED", label: "Delayed", tint: "var(--danger)" },
];
const STATUS_OPTIONS = COLUMNS.map((c) => c.key);

export default function DailyKanban({
  tasks: initialTasks,
  employees,
  canManage,
  canUpdateProgress,
  canDelete,
}: {
  tasks: Task[];
  employees: Employee[];
  canManage: boolean;
  canUpdateProgress: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  function applyUpdate(taskId: string, patch: Partial<Task>) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const next = { ...task, ...patch };

    setTasks((prev) => prev.map((t) => (t.id === taskId ? next : t)));
    startTransition(async () => {
      await updateTaskStatus(taskId, next.status, next.delayReason ?? undefined, next.actualQty);
      router.refresh();
    });
  }

  function changeStatus(taskId: string, newStatus: Task["status"]) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    let delayReason = task.delayReason;
    let actualQty = task.actualQty;

    if (newStatus === "DELAYED") {
      delayReason = window.prompt("Reason for delay?", task.delayReason ?? "") ?? task.delayReason ?? "";
    } else {
      delayReason = null;
    }

    if (newStatus === "COMPLETED" && task.targetQty !== null) {
      const entered = window.prompt(
        `Actual amount completed (${task.targetUnit})?`,
        String(task.actualQty || task.targetQty)
      );
      if (entered !== null && entered.trim() !== "" && !Number.isNaN(Number(entered))) {
        actualQty = Number(entered);
      }
    }

    applyUpdate(taskId, { status: newStatus, delayReason, actualQty });
  }

  function updateActual(taskId: string, actualQty: number) {
    applyUpdate(taskId, { actualQty });
  }

  function remove(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (!confirm(`Delete "${task.product} · ${task.process}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteDailyTask(taskId);
      router.refresh();
    });
  }

  function onDragEnd(result: DropResult) {
    if (!canUpdateProgress) return;
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    changeStatus(draggableId, destination.droppableId as Task["status"]);
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="card-shadow rounded-xl border border-border bg-surface p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: col.tint, boxShadow: `0 0 6px ${col.tint}` }}
                  />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {col.label}
                  </p>
                </div>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {colTasks.length}
                </span>
              </div>

              <Droppable droppableId={col.key}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="min-h-[120px] space-y-2"
                  >
                    {colTasks.map((t, index) => (
                      <Draggable key={t.id} draggableId={t.id} index={index} isDragDisabled={!canUpdateProgress}>
                        {(dragProvided, snapshot) => (
                          <KanbanCard
                            task={t}
                            canManage={canManage}
                            canUpdateProgress={canUpdateProgress}
                            canDelete={canDelete}
                            dragProvided={dragProvided}
                            snapshot={snapshot}
                            onEdit={() => setEditingTask(t)}
                            onDelete={() => remove(t.id)}
                            onChangeStatus={(s) => changeStatus(t.id, s)}
                            onUpdateActual={(v) => updateActual(t.id, v)}
                          />
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {colTasks.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
                        No tasks
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>

      {editingTask && (
        <EditTaskModal task={editingTask} employees={employees} onClose={() => setEditingTask(null)} />
      )}
    </DragDropContext>
  );
}

function KanbanCard({
  task: t,
  canManage,
  canUpdateProgress,
  canDelete,
  dragProvided,
  snapshot,
  onEdit,
  onDelete,
  onChangeStatus,
  onUpdateActual,
}: {
  task: Task;
  canManage: boolean;
  canUpdateProgress: boolean;
  canDelete: boolean;
  dragProvided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  onEdit: () => void;
  onDelete: () => void;
  onChangeStatus: (status: Task["status"]) => void;
  onUpdateActual: (value: number) => void;
}) {
  const [actualInput, setActualInput] = useState(t.actualQty);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setActualInput(t.actualQty);
    setDirty(false);
  }, [t.actualQty]);

  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      {...dragProvided.dragHandleProps}
      className={`group relative rounded-xl border border-border bg-surface-muted p-3 transition-shadow duration-150 ease-out ${
        snapshot.isDragging ? "card-elevated ring-1 ring-primary/40" : ""
      }`}
    >
      {(canManage || canDelete) && (
        <div className="absolute right-2 top-2 hidden items-center gap-2 group-hover:flex">
          {canManage && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onEdit}
              className="text-xs text-muted-foreground transition-colors duration-150 ease-out hover:text-primary"
              aria-label="Edit task"
            >
              ✎
            </button>
          )}
          {canDelete && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onDelete}
              className="text-xs text-muted-foreground transition-colors duration-150 ease-out hover:text-danger"
              aria-label="Delete task"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <div className="mb-1.5 flex items-center justify-between gap-2 pr-4">
        <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {t.teamName}
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_CLASS[t.priority]}`}>
          {PRIORITY_LABEL[t.priority]}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug text-foreground">
        {t.product} · {t.process}
      </p>
      {t.batchNo && <p className="text-[11px] text-muted-foreground">Batch {t.batchNo}</p>}
      {t.targetQty !== null && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.round((t.actualQty / t.targetQty) * 100))}%` }}
            />
          </div>
          {canUpdateProgress ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                type="number"
                value={actualInput}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  setActualInput(Number(e.target.value));
                  setDirty(true);
                }}
                className="w-16 rounded-lg border border-border bg-surface px-1.5 py-0.5 text-[10px] text-foreground"
              />
              <span className="text-[10px] text-muted-foreground">
                / {t.targetQty} {t.targetUnit}
              </span>
              {dirty && (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => onUpdateActual(actualInput)}
                  className="ml-auto rounded-md bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground hover:opacity-90"
                >
                  Save
                </button>
              )}
            </div>
          ) : (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {t.actualQty}/{t.targetQty} {t.targetUnit}
            </p>
          )}
        </div>
      )}
      {t.status === "DELAYED" && t.delayReason && (
        <p className="mt-1.5 text-[11px] text-danger">⚠ {t.delayReason}</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
            {t.employeeName ? initials(t.employeeName) : "?"}
          </div>
          <span
            className={`truncate text-[11px] ${t.employeeName ? "text-foreground" : "italic text-muted-foreground"}`}
          >
            {t.employeeName ?? "Unassigned"}
          </span>
        </div>
        {t.plannedStart && (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {t.plannedStart}–{t.plannedFinish ?? "?"}
          </span>
        )}
      </div>
      {canUpdateProgress && (
        <select
          value={t.status}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => onChangeStatus(e.target.value as Task["status"])}
          className="mt-2 w-full rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-foreground"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              Move to: {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
