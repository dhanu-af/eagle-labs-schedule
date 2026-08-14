"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Priority } from "@/generated/prisma";
import {
  createWeeklyMpsEntry,
  updateWeeklyMpsEntry,
  updateReadinessFlags,
  deleteWeeklyMpsEntry,
  computeMaterialReadiness,
  type WeeklyMpsEntryInput,
} from "@/lib/actions/weekly-mps-actions";
import { computePlannedQtyKg, computeMpsReadiness, PRIORITY_LABELS, MATERIAL_STATUS_LABELS } from "@/lib/weekly-mps-defaults";
import { formatWeekLabel, addWeeks } from "@/lib/week-utils";
import type { MaterialLineStatus } from "@/lib/customer-order-defaults";
import type { CapacityWeeklyCell } from "@/lib/actions/capacity-planning-actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export type MpsEntryRow = {
  id: string;
  weekEnding: string;
  machineId: string | null;
  machineName: string | null;
  productId: string;
  productName: string;
  productSku: string;
  batchSizeKg: number;
  plannedBatches: number;
  requiredDate: string | null;
  priority: Priority;
  frozen: boolean;
  qcReady: boolean;
  maintenanceReady: boolean;
  notes: string | null;
  createdByName: string | null;
};

type ProductOption = { id: string; sku: string; name: string; formulationId: string | null };
type MachineOption = { id: string; code: string; name: string };

const PRIORITIES = Object.keys(PRIORITY_LABELS) as Priority[];
const PRIORITY_TONE: Record<Priority, "danger" | "warning" | "info" | "muted"> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "muted",
};
const MATERIAL_TONE: Record<MaterialLineStatus | "NO_BOM", "success" | "danger" | "warning" | "muted"> = {
  READY: "success",
  SHORT: "danger",
  UNMAPPED: "warning",
  NO_BOM: "muted",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

type Draft = {
  machineId: string;
  productId: string;
  batchSizeKg: string;
  plannedBatches: string;
  requiredDate: string;
  priority: Priority;
  notes: string;
};

function emptyDraft(): Draft {
  return { machineId: "", productId: "", batchSizeKg: "", plannedBatches: "1", requiredDate: "", priority: "MEDIUM", notes: "" };
}

function draftFromEntry(entry: MpsEntryRow): Draft {
  return {
    machineId: entry.machineId ?? "",
    productId: entry.productId,
    batchSizeKg: String(entry.batchSizeKg),
    plannedBatches: String(entry.plannedBatches),
    requiredDate: entry.requiredDate ? entry.requiredDate.slice(0, 10) : "",
    priority: entry.priority,
    notes: entry.notes ?? "",
  };
}

function EntryModal({
  title,
  weekEndingIso,
  initial,
  products,
  machines,
  onSave,
  onClose,
}: {
  title: string;
  weekEndingIso: string;
  initial: Draft;
  products: ProductOption[];
  machines: MachineOption[];
  onSave: (draft: Draft) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const plannedQtyKg = useMemo(() => {
    const size = Number(draft.batchSizeKg);
    const batches = Number(draft.plannedBatches);
    return size > 0 && batches > 0 ? computePlannedQtyKg(size, batches) : null;
  }, [draft.batchSizeKg, draft.plannedBatches]);

  function save() {
    setError("");
    if (!draft.productId) return setError("Product is required.");
    if (!draft.batchSizeKg || Number(draft.batchSizeKg) <= 0) return setError("Batch size must be greater than 0.");
    if (!draft.plannedBatches || Number(draft.plannedBatches) <= 0) return setError("Planned batches must be greater than 0.");

    startTransition(async () => {
      try {
        await onSave(draft);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save MPS entry.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Week of {formatWeekLabel(new Date(weekEndingIso))}</p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="Product">
              <select className="input" value={draft.productId} onChange={(e) => setDraft((d) => ({ ...d, productId: e.target.value }))}>
                <option value="">Select...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Line / Area">
              <select className="input" value={draft.machineId} onChange={(e) => setDraft((d) => ({ ...d, machineId: e.target.value }))}>
                <option value="">Unassigned</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select className="input" value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as Priority }))}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="Batch Size (kg)">
              <input type="number" step="0.1" className="input" value={draft.batchSizeKg} onChange={(e) => setDraft((d) => ({ ...d, batchSizeKg: e.target.value }))} />
            </Field>
            <Field label="Planned Batches">
              <input type="number" step="1" className="input" value={draft.plannedBatches} onChange={(e) => setDraft((d) => ({ ...d, plannedBatches: e.target.value }))} />
            </Field>
            <Field label="Required Date">
              <input type="date" className="input" value={draft.requiredDate} onChange={(e) => setDraft((d) => ({ ...d, requiredDate: e.target.value }))} />
            </Field>
          </div>
          {plannedQtyKg != null && <p className="text-xs text-muted-foreground">Planned quantity: {plannedQtyKg} kg</p>}

          <Field label="Planner Notes">
            <textarea className="input" rows={2} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
          </Field>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  products,
  machines,
  machineCapacity,
  canManage,
}: {
  entry: MpsEntryRow;
  products: ProductOption[];
  machines: MachineOption[];
  machineCapacity: CapacityWeeklyCell | undefined;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [materialStatus, setMaterialStatus] = useState<MaterialLineStatus | "NO_BOM" | null>(null);
  const [error, setError] = useState("");

  const plannedQtyKg = computePlannedQtyKg(entry.batchSizeKg, entry.plannedBatches);
  const readiness = computeMpsReadiness({
    frozen: entry.frozen,
    materialStatus,
    qcReady: entry.qcReady,
    maintenanceReady: entry.maintenanceReady,
  });

  function checkMaterial() {
    setChecking(true);
    setError("");
    startTransition(async () => {
      try {
        setMaterialStatus(await computeMaterialReadiness(entry.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't check material.");
      } finally {
        setChecking(false);
      }
    });
  }

  function toggle(flag: "frozen" | "qcReady" | "maintenanceReady", value: boolean) {
    startTransition(async () => {
      try {
        await updateReadinessFlags(entry.id, { [flag]: value });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  function remove() {
    if (!confirm(`Delete this MPS entry for ${entry.productName}?`)) return;
    startTransition(async () => {
      try {
        await deleteWeeklyMpsEntry(entry.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete entry.");
      }
    });
  }

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {entry.productName} ({entry.productSku})
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.machineName ?? "Unassigned line"} · {entry.plannedBatches} batch{entry.plannedBatches === 1 ? "" : "es"} x {entry.batchSizeKg}kg = {plannedQtyKg}kg
            {entry.requiredDate && <> · Due {new Date(entry.requiredDate).toLocaleDateString()}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={PRIORITY_TONE[entry.priority]}>{PRIORITY_LABELS[entry.priority]}</Badge>
          <Badge tone={entry.frozen ? "info" : "muted"}>{entry.frozen ? "Frozen" : "Flexible"}</Badge>
          <Badge tone={readiness.ready ? "success" : "warning"}>{readiness.ready ? "Ready to Release" : "Not Ready"}</Badge>
          {machineCapacity && (
            <Badge tone={machineCapacity.overload ? "danger" : machineCapacity.utilizationPct != null && machineCapacity.utilizationPct >= 90 ? "warning" : "success"}>
              Line {machineCapacity.utilizationPct === null ? "—" : `${machineCapacity.utilizationPct}%`} this week
            </Badge>
          )}
          <button onClick={() => setExpanded((e) => !e)} className="text-xs text-muted-foreground hover:text-foreground">
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {!readiness.ready && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Not ready because: </span>
              {readiness.reasons.join(", ")}
            </p>
          )}
          {machineCapacity && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Line capacity this week: </span>
              {machineCapacity.scheduledHours}h scheduled / {machineCapacity.availableHours}h available
              {machineCapacity.overload && <span className="text-danger"> — already overloaded before this batch</span>}
              {" "}(from Capacity Planning&rsquo;s real machine schedule)
            </p>
          )}
          {entry.notes && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Notes: </span>
              {entry.notes}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={checkMaterial} disabled={checking}>
              {checking ? "Checking..." : "Check Material"}
            </Button>
            {materialStatus && <Badge tone={MATERIAL_TONE[materialStatus]}>Material: {MATERIAL_STATUS_LABELS[materialStatus]}</Badge>}
          </div>

          {canManage && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={entry.frozen} onChange={(e) => toggle("frozen", e.target.checked)} disabled={pending} />
                  Frozen
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={entry.qcReady} onChange={(e) => toggle("qcReady", e.target.checked)} disabled={pending} />
                  QC Ready
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={entry.maintenanceReady} onChange={(e) => toggle("maintenanceReady", e.target.checked)} disabled={pending} />
                  Maintenance Ready
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => (entry.frozen ? setError("Unfreeze this entry before editing.") : setEditing(true))}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Edit
                </button>
                <button
                  onClick={() => (entry.frozen ? setError("Unfreeze this entry before deleting.") : remove())}
                  className="text-xs text-danger hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
          {entry.createdByName && <p className="text-xs text-muted-foreground">Planned by {entry.createdByName}</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}

      {editing && (
        <EntryModal
          title={`Edit ${entry.productName}`}
          weekEndingIso={entry.weekEnding}
          initial={draftFromEntry(entry)}
          products={products}
          machines={machines}
          onClose={() => setEditing(false)}
          onSave={async (draft) => {
            const input: WeeklyMpsEntryInput = {
              weekEnding: entry.weekEnding,
              machineId: draft.machineId || null,
              productId: draft.productId,
              batchSizeKg: Number(draft.batchSizeKg),
              plannedBatches: Number(draft.plannedBatches),
              requiredDate: draft.requiredDate || null,
              priority: draft.priority,
              notes: draft.notes || null,
            };
            await updateWeeklyMpsEntry(entry.id, input);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

export default function WeeklyMpsClient({
  weekEndingIso,
  entries,
  products,
  machines,
  capacityByMachine,
  canManage,
}: {
  weekEndingIso: string;
  entries: MpsEntryRow[];
  products: ProductOption[];
  machines: MachineOption[];
  capacityByMachine: Record<string, CapacityWeeklyCell>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);

  function goToWeek(delta: number) {
    const next = addWeeks(new Date(weekEndingIso), delta);
    router.push(`/weekly-mps?week=${next.toISOString().slice(0, 10)}`);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Weekly MPS"
        subtitle="The finished-goods production plan by line, batch, and week — frozen and flexible horizons, with material, QC, and maintenance readiness."
        actions={canManage ? <Button size="sm" onClick={() => setShowNew(true)}>+ Add Entry</Button> : undefined}
      />

      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => goToWeek(-1)}>
          ← Prev Week
        </Button>
        <span className="text-sm font-medium text-foreground">Week of {formatWeekLabel(new Date(weekEndingIso))}</span>
        <Button size="sm" variant="secondary" onClick={() => goToWeek(1)}>
          Next Week →
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No MPS entries for this week" description="Add a line/product entry to start this week's production schedule." />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              products={products}
              machines={machines}
              machineCapacity={entry.machineId ? capacityByMachine[entry.machineId] : undefined}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      {showNew && (
        <EntryModal
          title="Add MPS Entry"
          weekEndingIso={weekEndingIso}
          initial={emptyDraft()}
          products={products}
          machines={machines}
          onClose={() => setShowNew(false)}
          onSave={async (draft) => {
            const input: WeeklyMpsEntryInput = {
              weekEnding: weekEndingIso,
              machineId: draft.machineId || null,
              productId: draft.productId,
              batchSizeKg: Number(draft.batchSizeKg),
              plannedBatches: Number(draft.plannedBatches),
              requiredDate: draft.requiredDate || null,
              priority: draft.priority,
              notes: draft.notes || null,
            };
            await createWeeklyMpsEntry(input);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
