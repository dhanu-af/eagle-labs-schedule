"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scheduleBatchRecord } from "@/lib/actions/capacity-planning-actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MachineRow, UnscheduledBatchRow } from "./capacity-planning-client";

function ScheduleForm({ batch, machines, onDone }: { batch: UnscheduledBatchRow; machines: MachineRow[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [machineId, setMachineId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  function save() {
    setError("");
    if (!machineId || !scheduledDate || !estimatedHours) return setError("Machine, date, and estimated hours are all required.");
    startTransition(async () => {
      try {
        await scheduleBatchRecord(batch.id, { machineId, scheduledDate, estimatedHours: Number(estimatedHours) });
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't schedule batch.");
      }
    });
  }

  return (
    <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-2">
      <select className="input" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
        <option value="">Machine...</option>
        {machines.filter((m) => m.active).map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <input type="date" className="input" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
      <input type="number" className="input" placeholder="Est. hours" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
      {error && <p className="col-span-3 text-xs text-danger">{error}</p>}
      <div className="col-span-3 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          Schedule
        </Button>
      </div>
    </div>
  );
}

export default function UnscheduledTab({ batches, machines, canManage }: { batches: UnscheduledBatchRow[]; machines: MachineRow[]; canManage: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (batches.length === 0) {
    return <EmptyState title="Nothing waiting" description="Every Batch Record is either scheduled or there are none yet." />;
  }

  return (
    <div className="space-y-2">
      {batches.map((b) => (
        <Card key={b.id} padding="sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                {b.batchNumber} — {b.productName}
              </p>
              <p className="text-xs text-muted-foreground">Status: {b.status}</p>
            </div>
            {canManage && (
              <Button size="sm" variant="secondary" onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                {openId === b.id ? "Cancel" : "Schedule"}
              </Button>
            )}
          </div>
          {openId === b.id && <ScheduleForm batch={b} machines={machines} onDone={() => setOpenId(null)} />}
        </Card>
      ))}
    </div>
  );
}
