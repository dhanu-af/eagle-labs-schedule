"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendTaskRequest } from "@/lib/actions/task-request-actions";
import { PRIORITY_LABEL } from "@/lib/ui";
import type { Priority } from "@/generated/prisma";

export type EmployeeOption = { id: string; name: string; teamName: string };

const PRIORITIES: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function SendTaskRequestCard({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toEmployeeId, setToEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function reset() {
    setToEmployeeId("");
    setTitle("");
    setMessage("");
    setPriority("MEDIUM");
    setDueDate("");
    setError("");
  }

  function send() {
    setError("");
    if (!toEmployeeId) return setError("Choose who this task is for.");
    if (!title.trim()) return setError("Title is required.");
    startTransition(async () => {
      try {
        await sendTaskRequest(toEmployeeId, { title: title.trim(), message: message.trim() || null, priority, dueDate: dueDate || null });
        reset();
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send task.");
      }
    });
  }

  const grouped = employees.reduce<Record<string, EmployeeOption[]>>((acc, e) => {
    (acc[e.teamName] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="card-shadow rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span aria-hidden>📨</span> Send a Task
        </h2>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          + New
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Send an urgent task to anyone in any department — it shows on their dashboard only.</p>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-elevated w-full max-w-md rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Send a Task</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">To</span>
                <select className="input" value={toEmployeeId} onChange={(e) => setToEmployeeId(e.target.value)}>
                  <option value="">Select a person...</option>
                  {Object.entries(grouped).map(([teamName, emps]) => (
                    <optgroup key={teamName} label={teamName}>
                      {emps.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Title</span>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Approve PO for capsule shells" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Message</span>
                <textarea className="input" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Priority</span>
                  <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</span>
                  <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </label>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={pending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-150 ease-out hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
