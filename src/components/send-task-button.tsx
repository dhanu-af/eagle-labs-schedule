"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendTaskRequest, listMyTaskRequestHistory, type TaskRequestHistoryRow } from "@/lib/actions/task-request-actions";
import { PRIORITY_LABEL } from "@/lib/ui";
import { Badge } from "@/components/ui/Badge";
import type { Priority, TaskRequestStatus } from "@/generated/prisma";

export type UserOption = { id: string; fullName: string; roleLabel: string };

const PRIORITIES: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUS_LABEL: Record<TaskRequestStatus, string> = { PENDING: "Pending", IN_PROGRESS: "In Progress", DONE: "Done" };
const STATUS_TONE: Record<TaskRequestStatus, "warning" | "info" | "success"> = { PENDING: "warning", IN_PROGRESS: "info", DONE: "success" };

/** Rendered globally in AppShell's header, next to the notification bell -- so any
 * logged-in person, on any page (including EXTRA's staging-only nav and OTHERS'
 * single-restricted-page nav, which never route through the Dashboard), can send
 * a task to any other specific person. Targets User (the login/session identity),
 * not Employee -- real data showed almost no login is linked to an Employee
 * record, which made an Employee-keyed version of this undeliverable. */
export default function SendTaskButton({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"send" | "history">("send");
  const [toUserId, setToUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [history, setHistory] = useState<TaskRequestHistoryRow[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  function reset() {
    setToUserId("");
    setTitle("");
    setMessage("");
    setPriority("MEDIUM");
    setDueDate("");
    setError("");
  }

  function openModal() {
    setView("send");
    setOpen(true);
  }

  function showHistory() {
    setView("history");
    if (history === null) {
      setHistoryError("");
      setHistoryLoading(true);
      listMyTaskRequestHistory()
        .then(setHistory)
        .catch((err) => setHistoryError(err instanceof Error ? err.message : "Couldn't load previous tasks."))
        .finally(() => setHistoryLoading(false));
    }
  }

  function send() {
    setError("");
    if (!toUserId) return setError("Choose who this task is for.");
    if (!title.trim()) return setError("Title is required.");
    startTransition(async () => {
      try {
        await sendTaskRequest(toUserId, { title: title.trim(), message: message.trim() || null, priority, dueDate: dueDate || null });
        reset();
        setHistory(null); // stale after sending a new one -- refetch next time History is opened
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send task.");
      }
    });
  }

  const grouped = users.reduce<Record<string, UserOption[]>>((acc, u) => {
    (acc[u.roleLabel] ??= []).push(u);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={openModal}
        aria-label="Send a task"
        title="Send a task to someone"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition hover:bg-surface-muted"
      >
        <span aria-hidden className="text-base leading-none">
          📨
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-elevated max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-1 rounded-lg border border-border bg-surface-muted p-0.5">
                <button
                  onClick={() => setView("send")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out ${
                    view === "send" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Send a Task
                </button>
                <button
                  onClick={showHistory}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out ${
                    view === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Previous Tasks
                </button>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
                ✕
              </button>
            </div>

            {view === "send" ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">To</span>
                  <select className="input" value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
                    <option value="">Select a person...</option>
                    {Object.entries(grouped).map(([roleLabel, roleUsers]) => (
                      <optgroup key={roleLabel} label={roleLabel}>
                        {roleUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName}
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
            ) : (
              <div className="space-y-2">
                {historyLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
                {historyError && <p className="text-xs text-danger">{historyError}</p>}
                {!historyLoading && !historyError && history?.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nothing sent or received yet.</p>
                )}
                {history?.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{r.title}</p>
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </div>
                    {r.message && <p className="mt-0.5 text-xs text-muted-foreground">{r.message}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.direction === "SENT" ? `To ${r.counterpartyName}` : `From ${r.counterpartyName}`} · {new Date(r.createdAt).toLocaleDateString()}
                      {r.dueDate && ` · Due ${new Date(r.dueDate).toLocaleDateString()}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
