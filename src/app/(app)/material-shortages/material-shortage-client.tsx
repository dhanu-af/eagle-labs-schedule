"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionLogStatus, EscalationLevel } from "@/generated/prisma";
import { upsertShortageWatch, type MaterialShortageRow } from "@/lib/actions/material-shortage-actions";
import { ESCALATION_LEVEL_LABELS, WATCH_STATUS_LABELS } from "@/lib/material-shortage-defaults";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import SendTaskForm, { type UserOption } from "@/components/send-task-form";

const RISK_TONE: Record<EscalationLevel, "success" | "warning" | "danger"> = { GREEN: "success", AMBER: "warning", RED: "danger" };
const STATUSES = Object.keys(WATCH_STATUS_LABELS) as ActionLogStatus[];

function SendShortageTaskModal({
  row,
  taskRequestRecipients,
  onClose,
}: {
  row: MaterialShortageRow;
  taskRequestRecipients: UserOption[];
  onClose: () => void;
}) {
  const summary = `Material shortage — ${row.itemName} (${row.itemCode})`;
  const affected = row.affectedOrders.map((o) => `${o.orderNumber} (${o.requiredQtyKg}${row.unit})`).join(", ");
  const details = `Short ${row.netShortageKg}${row.unit}, need by ${new Date(row.earliestNeedDate).toLocaleDateString()}.${
    affected ? ` Affects orders: ${affected}.` : ""
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Send Task</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <SendTaskForm
          users={taskRequestRecipients}
          initialTitle={summary}
          initialMessage={details}
          initialPriority={row.riskLevel === "RED" ? "HIGH" : "MEDIUM"}
          link="/material-shortages"
          onSent={onClose}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

function ShortageRow({
  row,
  canManage,
  taskRequestRecipients,
}: {
  row: MaterialShortageRow;
  canManage: boolean;
  taskRequestRecipients: UserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState(row.watchAction ?? "");
  const [owner, setOwner] = useState(row.watchOwner ?? "");
  const [status, setStatus] = useState<ActionLogStatus>(row.watchStatus ?? "OPEN");
  const [error, setError] = useState("");
  const [showSendTask, setShowSendTask] = useState(false);

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await upsertShortageWatch(row.warehouseItemId, { action: action || null, owner: owner || null, status });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {row.itemName} ({row.itemCode})
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Required {row.requiredQtyKg}{row.unit} · Available {row.availableQtyKg}{row.unit} · Short {row.netShortageKg}{row.unit} · Need by {new Date(row.earliestNeedDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={RISK_TONE[row.riskLevel]}>{ESCALATION_LEVEL_LABELS[row.riskLevel]}</Badge>
          {row.watchStatus && <Badge tone="muted">{WATCH_STATUS_LABELS[row.watchStatus]}</Badge>}
          <button onClick={() => setExpanded((e) => !e)} className="text-xs text-muted-foreground hover:text-foreground">
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Affected orders</p>
            <p className="text-xs text-foreground">{row.affectedOrders.map((o) => `${o.orderNumber} (${o.requiredQtyKg}${row.unit})`).join(", ")}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Incoming supply</p>
            {row.incomingPo ? (
              <p className="text-xs text-foreground">
                {row.incomingPo.quantity}{row.unit} from {row.incomingPo.supplierName} ({row.incomingPo.poNumber}), expected {new Date(row.incomingPo.expectedDeliveryDate).toLocaleDateString()}
              </p>
            ) : (
              <p className="text-xs text-danger">Nothing on order to cover this shortage</p>
            )}
          </div>

          {canManage && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Owner</span>
                  <input className="input" placeholder="Who's on this" value={owner} onChange={(e) => setOwner(e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Status</span>
                  <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ActionLogStatus)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {WATCH_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Action</span>
                <input className="input" placeholder="Expedite PO, substitute item, escalate..." value={action} onChange={(e) => setAction(e.target.value)} />
              </label>
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
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}

      {showSendTask && (
        <SendShortageTaskModal row={row} taskRequestRecipients={taskRequestRecipients} onClose={() => setShowSendTask(false)} />
      )}
    </Card>
  );
}

export default function MaterialShortageClient({
  shortages,
  canManage,
  taskRequestRecipients,
}: {
  shortages: MaterialShortageRow[];
  canManage: boolean;
  taskRequestRecipients: UserOption[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shortages.filter((s) => !q || `${s.itemCode} ${s.itemName}`.toLowerCase().includes(q));
  }, [shortages, search]);

  const redCount = shortages.filter((s) => s.riskLevel === "RED").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Material Shortage Register"
        subtitle="Every material currently short once demand is netted across all active orders — not just one order at a time."
      />

      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <Card padding="sm">
          <p className="text-xs text-muted-foreground">Materials short</p>
          <p className="text-xl font-semibold text-foreground">{shortages.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-muted-foreground">Red risk</p>
          <p className="text-xl font-semibold text-danger">{redCount}</p>
        </Card>
      </div>

      <input className="input w-full sm:w-64" placeholder="Search item, code..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 ? (
        <EmptyState title="No material shortages right now" description="Every active order's ingredients are fully covered by usable stock." />
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => (
            <ShortageRow key={row.warehouseItemId} row={row} canManage={canManage} taskRequestRecipients={taskRequestRecipients} />
          ))}
        </div>
      )}
    </div>
  );
}
