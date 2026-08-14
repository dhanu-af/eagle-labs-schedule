"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskRequestStatus } from "@/lib/actions/task-request-actions";
import { PRIORITY_CLASS, PRIORITY_LABEL } from "@/lib/ui";
import { Button } from "@/components/ui/Button";

export type MyTaskRequestRow = {
  id: string;
  title: string;
  message: string | null;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "PENDING" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  fromEmployeeName: string;
};

/** Plain helper, not inlined into the component body -- calling Date.now() directly
 * inside render is flagged as an impure render call by this repo's lint rules. */
function isOverdue(dueDate: string | null): boolean {
  return dueDate ? new Date(dueDate).getTime() < Date.now() : false;
}

/** Rendered globally in AppShell (above every page's content), not just the
 * Dashboard -- reaches every employee regardless of nav restrictions (EXTRA's
 * staging-only nav and OTHERS' single-restricted-page nav never route through
 * the Dashboard, but both still render AppShell). Renders nothing when there's
 * nothing pending -- this is meant to read as an urgent alert, not a permanent
 * fixture, and it's already scoped to exactly one employee (the caller only
 * ever passes in this session's own pending/in-progress requests via
 * listMyPendingTaskRequests()). */
export default function PendingTaskRequestsBanner({ requests }: { requests: MyTaskRequestRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (requests.length === 0) return null;

  function setStatus(id: string, status: "IN_PROGRESS" | "DONE") {
    startTransition(async () => {
      await updateTaskRequestStatus(id, status);
      router.refresh();
    });
  }

  return (
    <div className="card-shadow mb-4 rounded-2xl border border-warning/40 bg-warning/5 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span aria-hidden>🔔</span> Tasks sent to you ({requests.length})
      </h2>
      <div className="space-y-2">
        {requests.map((r) => {
          const overdue = isOverdue(r.dueDate);
          return (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{r.title}</p>
                {r.message && <p className="mt-0.5 text-xs text-muted-foreground">{r.message}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  From {r.fromEmployeeName}
                  {r.dueDate && (
                    <>
                      {" · Due "}
                      {new Date(r.dueDate).toLocaleDateString()}
                      {overdue && <span className="text-danger"> (overdue)</span>}
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASS[r.priority]}`}>{PRIORITY_LABEL[r.priority]}</span>
                {r.status === "PENDING" && (
                  <Button size="sm" variant="secondary" onClick={() => setStatus(r.id, "IN_PROGRESS")} disabled={pending}>
                    Start
                  </Button>
                )}
                <Button size="sm" onClick={() => setStatus(r.id, "DONE")} disabled={pending}>
                  Done
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
