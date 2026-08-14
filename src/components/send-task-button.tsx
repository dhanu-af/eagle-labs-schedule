"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listMyTaskRequestHistory, type TaskRequestHistoryRow } from "@/lib/actions/task-request-actions";
import { Badge } from "@/components/ui/Badge";
import SendTaskForm, { type UserOption } from "@/components/send-task-form";
import type { TaskRequestStatus } from "@/generated/prisma";

export type { UserOption };

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

  const [history, setHistory] = useState<TaskRequestHistoryRow[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

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

  function handleSent() {
    setHistory(null); // stale after sending a new one -- refetch next time History is opened
    setOpen(false);
    router.refresh();
  }

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
              <SendTaskForm users={users} onSent={handleSent} onCancel={() => setOpen(false)} />
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
                    {r.link && (
                      <Link href={r.link} onClick={() => setOpen(false)} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                        View record →
                      </Link>
                    )}
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
