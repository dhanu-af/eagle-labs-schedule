"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionLogStatus } from "@/generated/prisma";
import { upsertCapacityRecoveryAction, type CapacityWeeklyRow } from "@/lib/actions/capacity-planning-actions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import SendTaskForm, { type UserOption } from "@/components/send-task-form";

const WATCH_STATUS_LABELS: Record<ActionLogStatus, string> = { OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", CLOSED: "Closed" };
const STATUSES = Object.keys(WATCH_STATUS_LABELS) as ActionLogStatus[];

function cellTone(overload: boolean, utilizationPct: number | null): "danger" | "warning" | "success" | "muted" {
  if (overload) return "danger";
  if (utilizationPct === null) return "muted";
  if (utilizationPct >= 90) return "warning";
  return "success";
}

function formatWeekHeader(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(new Date(`${dateKey}T00:00:00.000Z`))}`;
}

export default function WeeklyRollupTab({
  rollup,
  canManage,
  taskRequestRecipients,
}: {
  rollup: { weekEndings: string[]; rows: CapacityWeeklyRow[] };
  canManage: boolean;
  taskRequestRecipients: UserOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{ machineId: string; weekEnding: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [recoveryAction, setRecoveryAction] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<ActionLogStatus>("OPEN");
  const [error, setError] = useState("");
  const [showSendTask, setShowSendTask] = useState(false);

  if (rollup.rows.length === 0) {
    return <EmptyState title="No machines yet" description="Add a machine on the Machines tab to start seeing weekly utilisation here." />;
  }

  const selectedRow = selected ? rollup.rows.find((r) => r.machineId === selected.machineId) : null;
  const selectedCell = selected ? selectedRow?.weeks.find((w) => w.weekEnding === selected.weekEnding) : null;

  function select(machineId: string, weekEnding: string, cell: CapacityWeeklyRow["weeks"][number]) {
    setSelected({ machineId, weekEnding });
    setRecoveryAction(cell.recoveryAction ?? "");
    setOwner(cell.recoveryOwner ?? "");
    setStatus(cell.recoveryStatus ?? "OPEN");
    setError("");
    setShowSendTask(false);
  }

  function save() {
    if (!selected) return;
    setError("");
    startTransition(async () => {
      try {
        await upsertCapacityRecoveryAction(selected.machineId, selected.weekEnding, { recoveryAction: recoveryAction || null, owner: owner || null, status });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save recovery action.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-muted/40 text-left text-muted-foreground">
                <th className="sticky left-0 bg-surface-muted/40 px-3 py-2 font-medium">Machine</th>
                {rollup.weekEndings.map((w) => (
                  <th key={w} className="px-2 py-2 text-center font-medium">
                    {formatWeekHeader(w)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rollup.rows.map((row) => (
                <tr key={row.machineId} className="border-b border-border last:border-0">
                  <td className="sticky left-0 bg-surface px-3 py-2 font-medium text-foreground">
                    {row.name}
                    {row.workCenter && <span className="ml-1 text-muted-foreground">({row.workCenter})</span>}
                  </td>
                  {row.weeks.map((cell) => {
                    const isSelected = selected?.machineId === row.machineId && selected?.weekEnding === cell.weekEnding;
                    return (
                      <td key={cell.weekEnding} className="px-1 py-1 text-center">
                        <button onClick={() => select(row.machineId, cell.weekEnding, cell)} className={`w-full rounded px-1.5 py-1 ${isSelected ? "ring-2 ring-primary" : ""}`}>
                          <Badge tone={cellTone(cell.overload, cell.utilizationPct)} className="w-full justify-center">
                            {cell.utilizationPct === null ? "—" : `${cell.utilizationPct}%`}
                          </Badge>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && selectedCell && selectedRow && (
        <Card padding="sm">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {selectedRow.name} — week of {formatWeekHeader(selected.weekEnding)}
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Available</p>
              <p className="font-medium text-foreground">{selectedCell.availableHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Scheduled</p>
              <p className="font-medium text-foreground">{selectedCell.scheduledHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className={`font-medium ${selectedCell.overload ? "text-danger" : "text-foreground"}`}>{selectedCell.remainingHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{selectedCell.overload ? <span className="text-danger">Overload</span> : "OK"}</p>
            </div>
          </div>

          {canManage ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Recovery action</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <input className="input" placeholder="Overtime, resequencing, outsourcing..." value={recoveryAction} onChange={(e) => setRecoveryAction(e.target.value)} />
                <input className="input" placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ActionLogStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {WATCH_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                {taskRequestRecipients.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => setShowSendTask(true)}>
                    Send Task
                  </Button>
                )}
                <Button size="sm" onClick={save} disabled={pending}>
                  {pending ? "Saving..." : "Save"}
                </Button>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
            </div>
          ) : (
            selectedCell.recoveryAction && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Recovery action: </span>
                {selectedCell.recoveryAction} ({selectedCell.recoveryOwner ?? "no owner"})
              </p>
            )
          )}
        </Card>
      )}

      {showSendTask && selected && selectedCell && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Send Task</h2>
              <button
                onClick={() => setShowSendTask(false)}
                className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <SendTaskForm
              users={taskRequestRecipients}
              initialTitle={`Machine overload — ${selectedRow.name}, week of ${formatWeekHeader(selected.weekEnding)}`}
              initialMessage={`${selectedCell.scheduledHours}h scheduled vs ${selectedCell.availableHours}h available (${selectedCell.remainingHours}h over).${
                recoveryAction ? ` Proposed recovery: ${recoveryAction}.` : ""
              }`}
              initialPriority="HIGH"
              link="/capacity-planning"
              onSent={() => setShowSendTask(false)}
              onCancel={() => setShowSendTask(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
