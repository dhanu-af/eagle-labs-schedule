"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  copyPreviousWeek,
  createWeeklyAssignment,
  deleteWeeklyAssignment,
  moveWeeklyAssignment,
  updateWeeklyAssignment,
} from "@/lib/actions/weekly-actions";
import { suggestWeeklyBalance } from "@/lib/actions/ai-actions";
import { toDateInputValue } from "@/lib/ui";

type Team = { id: string; name: string };
type Employee = { id: string; name: string };
type Assignment = {
  id: string;
  dayOfWeek: number;
  employeeId: string;
  employeeName: string;
  task: string;
  hours: number;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CAPACITY_PER_EMPLOYEE = 8;

export default function WeeklyPlannerClient({
  weekStartStr,
  teams,
  activeTeamId,
  employees,
  assignments: initialAssignments,
  canManage,
}: {
  weekStartStr: string;
  teams: Team[];
  activeTeamId: string;
  employees: Employee[];
  assignments: Assignment[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [pending, startTransition] = useTransition();
  const [modalDay, setModalDay] = useState<number | null>(null);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const weekStartDate = new Date(`${weekStartStr}T00:00:00`);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekEndDate = days[6];

  function goWeek(offset: number) {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + offset * 7);
    router.push(`/weekly?week=${toDateInputValue(d)}&team=${activeTeamId}`);
  }

  function switchTeam(teamId: string) {
    router.push(`/weekly?week=${weekStartStr}&team=${teamId}`);
  }

  function onDragEnd(result: DropResult) {
    if (!canManage) return;
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const newDay = Number(destination.droppableId);

    setAssignments((prev) =>
      prev.map((a) => (a.id === draggableId ? { ...a, dayOfWeek: newDay } : a))
    );
    startTransition(async () => {
      await moveWeeklyAssignment(draggableId, newDay);
    });
  }

  function removeAssignment(id: string) {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      await deleteWeeklyAssignment(id);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Weekly Production Planner</h1>
          <p className="text-sm text-muted-foreground">
            {days[0].toLocaleDateString("en-AU", { day: "2-digit", month: "short" })} –{" "}
            {weekEndDate.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => goWeek(-1)} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground hover:bg-surface-muted">
            ← Prev
          </button>
          <button onClick={() => goWeek(1)} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground hover:bg-surface-muted">
            Next →
          </button>
          {canManage && (
            <>
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await copyPreviousWeek(weekStartStr, activeTeamId);
                    router.refresh();
                  })
                }
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-60"
              >
                Copy previous week
              </button>
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await suggestWeeklyBalance(weekStartStr, activeTeamId);
                    setSuggestion(result);
                  })
                }
                className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
              >
                ✨ AI Balance Suggestion
              </button>
            </>
          )}
        </div>
      </div>

      {suggestion && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
          <div className="mb-1 flex items-center justify-between">
            <p className="font-semibold">✨ AI Balance Suggestion</p>
            <button onClick={() => setSuggestion(null)} className="text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
          <p className="whitespace-pre-line text-muted-foreground">{suggestion}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTeam(t.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              t.id === activeTeamId
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((d, dayIndex) => {
            const dayAssignments = assignments.filter((a) => a.dayOfWeek === dayIndex);
            const totalHours = dayAssignments.reduce((s, a) => s + a.hours, 0);
            const capacity = employees.length * CAPACITY_PER_EMPLOYEE;
            const overCapacity = capacity > 0 && totalHours > capacity;

            return (
              <div key={dayIndex} className="rounded-xl border border-border bg-surface p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{DAY_LABELS[dayIndex]}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      overCapacity
                        ? "border-danger/30 bg-danger/10 text-danger"
                        : "border-border bg-surface-muted text-muted-foreground"
                    }`}
                  >
                    {totalHours}h{capacity ? `/${capacity}h` : ""}
                  </span>
                </div>

                <Droppable droppableId={String(dayIndex)}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="min-h-[80px] space-y-2"
                    >
                      {dayAssignments.map((a, index) => (
                        <Draggable
                          key={a.id}
                          draggableId={a.id}
                          index={index}
                          isDragDisabled={!canManage}
                        >
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`group relative rounded-lg border border-border bg-surface-muted p-2 text-xs ${
                                snapshot.isDragging ? "shadow-lg ring-2 ring-primary" : ""
                              }`}
                            >
                              <p className="font-medium text-foreground">{a.employeeName}</p>
                              <p className="text-muted-foreground">{a.task}</p>
                              <p className="text-muted-foreground">{a.hours}h</p>
                              {canManage && (
                                <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                                  <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={() => setEditAssignment(a)}
                                    className="text-muted-foreground hover:text-primary"
                                    aria-label="Edit assignment"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={() => removeAssignment(a.id)}
                                    className="text-muted-foreground hover:text-danger"
                                    aria-label="Remove assignment"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {canManage && (
                  <button
                    onClick={() => setModalDay(dayIndex)}
                    className="mt-2 w-full rounded-lg border border-dashed border-border py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    + Assign
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {modalDay !== null && (
        <AssignModal
          weekStartStr={weekStartStr}
          teamId={activeTeamId}
          dayOfWeek={modalDay}
          dayLabel={`${DAY_LABELS[modalDay]} ${days[modalDay].toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}`}
          employees={employees}
          onClose={() => setModalDay(null)}
        />
      )}

      {editAssignment && (
        <EditAssignmentModal
          assignment={editAssignment}
          onClose={() => setEditAssignment(null)}
        />
      )}
    </div>
  );
}

function EditAssignmentModal({
  assignment,
  onClose,
}: {
  assignment: Assignment;
  onClose: () => void;
}) {
  const router = useRouter();
  const [task, setTask] = useState(assignment.task);
  const [hours, setHours] = useState(assignment.hours);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      await updateWeeklyAssignment(assignment.id, task, hours);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Edit Assignment — {assignment.employeeName}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Task / Product</span>
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Hours</span>
            <input
              type="number"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignModal({
  weekStartStr,
  teamId,
  dayOfWeek,
  dayLabel,
  employees,
  onClose,
}: {
  weekStartStr: string;
  teamId: string;
  dayOfWeek: number;
  dayLabel: string;
  employees: Employee[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      await createWeeklyAssignment(formData);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Assign — {dayLabel}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <form action={submit} className="space-y-3">
          <input type="hidden" name="weekStart" value={weekStartStr} />
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Employee</span>
            <select name="employeeId" required className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Task / Product</span>
            <input name="task" required className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Hours</span>
            <input name="hours" type="number" step="0.5" defaultValue={8} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving..." : "Assign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
