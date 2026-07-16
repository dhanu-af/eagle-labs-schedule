"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DryingBayPurpose, DryingStage, TrolleyQcStatus } from "@/generated/prisma";
import {
  PURPOSE_LABEL,
  STAGE_LABEL,
  STAGE_ACTIONS,
  BAY_STATUS_LABEL,
  BAY_STATUS_CLASS,
  PRIORITY_LABEL,
  PRIORITY_BADGE,
  computeBayStatus,
  computeBatchAlerts,
  computeBayAlerts,
  daysSinceProduction,
  type DryingAlert,
} from "@/lib/drying-room-defaults";
import { generateMorningReportText } from "@/lib/generate-morning-report";
import {
  createBay,
  updateBayPurpose,
  createBatch,
  deleteBatch,
  moveBatchToBay,
  updateBatchStage,
  updateBatchPriority,
  updateTrolley,
  upsertMiscStorageItem,
  deleteMiscStorageItem,
  sendMorningReportToWhatsApp,
} from "@/lib/actions/drying-room-actions";
import { formatBrisbaneDateTime, toDateInputValue } from "@/lib/ui";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

type Employee = { id: string; name: string };
type WhatsAppGroupOpt = { id: string; name: string };

type Trolley = {
  id: string;
  trolleyNumber: number;
  quantity: number | null;
  trayCount: number | null;
  wrapped: boolean;
  rotationCompleted: boolean;
  qcStatus: TrolleyQcStatus;
  assignedEmployeeId: string | null;
  remarks: string | null;
};

type Batch = {
  id: string;
  productName: string;
  batchNumber: string;
  batchSize: number;
  batchSizeUnit: string;
  numberOfTrolleys: number;
  trayCount: number;
  dateEnteredDryingRoom: string;
  dryingStartTime: string | null;
  currentStage: DryingStage;
  stageUpdatedAt: string;
  assignedEmployeeId: string | null;
  priorityRank: number | null;
  trolleys: Trolley[];
};

type Bay = {
  id: string;
  bayNumber: number;
  purpose: DryingBayPurpose;
  assignedEmployeeId: string | null;
  department: string | null;
  comments: string | null;
  expectedFinishTime: string | null;
  updatedAt: string;
  batches: Batch[];
};

type MiscItem = {
  id: string;
  product: string;
  batchNumber: string | null;
  quantityLabel: string;
  storageType: string | null;
  status: string | null;
  requiredAction: string | null;
  location: string | null;
  remarks: string | null;
  updatedAt: string;
};

const PURPOSE_OPTIONS: DryingBayPurpose[] = [
  "EMPTY",
  "DRYING",
  "WAITING_QC",
  "READY_FOR_POUCHING",
  "READY_FOR_PRODUCTION",
  "CLEANING_REQUIRED",
  "SORTING",
  "QA_QC_APPROVALS",
  "POLISHING",
  "COATING",
  "RE_COATING",
  "QUARANTINE",
  "SORTING_REQUIRED",
  "COATING_REQUIRED",
  "POLISHING_REQUIRED",
  "MANUAL_PACKING_REQUIRED",
  "CLEANED",
  "RND",
  "STORAGE",
  "SERVICE",
];

const STAGE_OPTIONS: DryingStage[] = [
  "RECEIVING",
  "DRYING",
  "ROTATION_REQUIRED",
  "CONTINUE_DRYING",
  "QC_SAMPLING",
  "QC_PENDING",
  "QC_APPROVED",
  "QC_HOLD",
  "WRAPPING",
  "READY_FOR_POUCHING",
  "POUCHING",
  "COMPLETE",
  "SORTING",
  "QA_QC_APPROVALS",
  "POLISHING",
  "COATING",
  "RE_COATING",
  "QUARANTINE",
  "SORTING_REQUIRED",
  "COATING_REQUIRED",
  "POLISHING_REQUIRED",
  "MANUAL_PACKING_REQUIRED",
  "CLEANED",
];

const TABS = ["dashboard", "bays", "misc", "report"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  dashboard: "Dashboard",
  bays: "Bays",
  misc: "Misc Storage",
  report: "Reports",
};

function employeeName(employees: Employee[], id: string | null) {
  return id ? employees.find((e) => e.id === id)?.name ?? "Unknown" : null;
}

export default function DryingRoomClient({
  bays,
  misc,
  employees,
  whatsAppGroups,
  canManage,
}: {
  bays: Bay[];
  misc: MiscItem[];
  employees: Employee[];
  whatsAppGroups: WhatsAppGroupOpt[];
  canManage: boolean;
}) {
  const searchParams = useSearchParams();
  const bayParam = searchParams.get("bay");
  const [tab, setTab] = useState<Tab>(bayParam ? "bays" : "dashboard");
  const [openBayId, setOpenBayId] = useState<string | null>(bayParam);

  const allBatches = useMemo(() => bays.flatMap((b) => b.batches), [bays]);

  const alerts = useMemo<DryingAlert[]>(() => {
    const bayAlerts = bays.flatMap((b) => computeBayAlerts(b.bayNumber, b.purpose, b.batches));
    const batchAlerts = allBatches.flatMap((b) => computeBatchAlerts(b));
    return [...bayAlerts, ...batchAlerts];
  }, [bays, allBatches]);

  const openBay = bays.find((b) => b.id === openBayId) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Production Staging Operations"
        subtitle="Live bay and batch status — replaces the daily WhatsApp drying room update."
      />

      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {alerts.length > 0 && (
        <Card padding="sm" className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            Alerts ({alerts.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {alerts.map((a) => (
              <span
                key={a.key + a.label}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  a.severity === "danger"
                    ? "border-danger/30 bg-danger/10 text-danger"
                    : "border-warning/30 bg-warning/10 text-warning"
                }`}
              >
                {a.label}
              </span>
            ))}
          </div>
        </Card>
      )}

      {tab === "dashboard" && <DashboardTab bays={bays} allBatches={allBatches} alerts={alerts} />}

      {tab === "bays" && (
        <BaysGrid bays={bays} employees={employees} canManage={canManage} onOpenBay={setOpenBayId} />
      )}

      {tab === "misc" && <MiscStorageTab items={misc} canManage={canManage} />}

      {tab === "report" && <MorningReportTab bays={bays} misc={misc} whatsAppGroups={whatsAppGroups} />}

      {openBay && (
        <BayDetailModal
          bay={openBay}
          allBays={bays}
          employees={employees}
          canManage={canManage}
          onClose={() => setOpenBayId(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  onClick,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      interactive
      padding="sm"
      onClick={onClick}
      className={`${onClick ? "cursor-pointer" : ""} ${highlight ? "border-warning/40 bg-warning/10" : ""}`}
    >
      <p className={`text-2xl font-semibold tabular-nums ${highlight ? "text-warning" : "text-foreground"}`}>{value}</p>
      <p className={`text-xs ${highlight ? "text-warning/80" : "text-muted-foreground"}`}>{label}</p>
    </Card>
  );
}

function DashboardTab({ bays, allBatches, alerts }: { bays: Bay[]; allBatches: Batch[]; alerts: DryingAlert[] }) {
  const [showPriorityList, setShowPriorityList] = useState(false);
  const priorityJobs = bays
    .flatMap((bay) => bay.batches.map((batch) => ({ ...batch, bayNumber: bay.bayNumber })))
    .filter((b) => b.priorityRank !== null)
    .sort((a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99));
  const totalBays = bays.length;
  const occupiedBays = bays.filter((b) => b.batches.length > 0).length;
  const emptyBays = bays.filter((b) => b.purpose === "EMPTY" && b.batches.length === 0).length;
  const dryingCount = allBatches.filter((b) => b.currentStage === "DRYING" || b.currentStage === "CONTINUE_DRYING").length;
  const waitingQcCount = allBatches.filter((b) => b.currentStage === "QC_SAMPLING" || b.currentStage === "QC_PENDING").length;
  const readyForPouchingCount = allBatches.filter((b) => b.currentStage === "READY_FOR_POUCHING").length;
  const cleaningRequiredCount = bays.filter((b) => b.purpose === "CLEANING_REQUIRED").length;
  const rotationRequiredCount = allBatches.filter((b) => b.currentStage === "ROTATION_REQUIRED").length;
  const wrappedTrolleys = allBatches.reduce((s, b) => s + b.trolleys.filter((t) => t.wrapped).length, 0);
  const onHoldCount = allBatches.filter((b) => b.currentStage === "QC_HOLD").length;
  const overdueBatchIds = new Set(
    allBatches.filter((b) => computeBatchAlerts(b).some((a) => a.severity === "danger")).map((b) => b.id)
  );
  const totalTrolleys = allBatches.reduce((s, b) => s + b.numberOfTrolleys, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Live Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <StatCard label="Total Bays" value={totalBays} />
          <StatCard label="Occupied Bays" value={occupiedBays} />
          <StatCard label="Empty Bays" value={emptyBays} />
          <StatCard label="Drying" value={dryingCount} />
          <StatCard label="Waiting QC" value={waitingQcCount} />
          <StatCard label="Ready for Pouching" value={readyForPouchingCount} />
          <StatCard label="Cleaning Required" value={cleaningRequiredCount} />
          <StatCard label="Rotation Required" value={rotationRequiredCount} />
          <StatCard label="Wrapped Products" value={wrappedTrolleys} />
          <StatCard label="Overdue Batches" value={overdueBatchIds.size} />
          <StatCard
            label="Priority Jobs"
            value={priorityJobs.length}
            highlight
            onClick={() => setShowPriorityList((v) => !v)}
          />
        </div>

        {showPriorityList && (
          <div className="mt-3 space-y-1.5 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning/80">
              Priority Jobs ({priorityJobs.length})
            </p>
            {priorityJobs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No batches have a priority set right now.</p>
            ) : (
              priorityJobs.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-1 rounded-md border border-border/60 bg-surface-muted/30 px-2 py-1.5 text-xs"
                >
                  <span className="font-medium text-foreground">
                    {PRIORITY_BADGE[b.priorityRank!]} {b.productName} · Batch {b.batchNumber}
                  </span>
                  <span className="text-muted-foreground">
                    Bay {b.bayNumber} · {STAGE_LABEL[b.currentStage]}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Dashboard KPIs</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <StatCard label="Total Products in Drying" value={dryingCount + rotationRequiredCount} />
          <StatCard label="Total Trolleys" value={totalTrolleys} />
          <StatCard label="Bays Available" value={emptyBays} />
          <StatCard label="Products Waiting QC" value={waitingQcCount} />
          <StatCard label="Products Ready for Pouching" value={readyForPouchingCount} />
          <StatCard label="Products on Hold" value={onHoldCount} />
          <StatCard label="Cleaning Tasks" value={cleaningRequiredCount} />
          <StatCard label="Overdue Batches" value={overdueBatchIds.size} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Average Drying Time, Daily/Weekly Throughput, and Average Time to QC/Pouching need stage-transition
          history and are not wired up yet — flag if you want those added next.
        </p>
      </div>

      {alerts.length === 0 && (
        <p className="text-xs text-muted-foreground">No active alerts — everything is on schedule.</p>
      )}
    </div>
  );
}

function BaysGrid({
  bays,
  employees,
  canManage,
  onOpenBay,
}: {
  bays: Bay[];
  employees: Employee[];
  canManage: boolean;
  onOpenBay: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function addBay() {
    startTransition(async () => {
      await createBay();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={addBay} disabled={pending}>
            {pending ? "Adding..." : "+ Add Bay"}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {bays.map((bay) => {
        const status = computeBayStatus(bay.purpose, bay.batches);
        const operatorName = employeeName(employees, bay.assignedEmployeeId);
        return (
          <Card key={bay.id} interactive padding="sm" className="cursor-pointer" onClick={() => onOpenBay(bay.id)}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Bay {bay.bayNumber}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${BAY_STATUS_CLASS[status]}`}>
                {BAY_STATUS_LABEL[status]}
              </span>
            </div>
            {bay.batches.length === 0 ? (
              <p className="text-xs text-muted-foreground">{PURPOSE_LABEL[bay.purpose]}</p>
            ) : (
              <div className="space-y-2">
                {[...bay.batches]
                  .sort((a, b) => (a.priorityRank ?? 99) - (b.priorityRank ?? 99))
                  .map((b) => (
                    <div key={b.id} className="rounded-md border border-border/60 bg-surface-muted/30 px-2 py-1.5 text-xs">
                      <p className="font-medium text-foreground">
                        {b.priorityRank && `${PRIORITY_BADGE[b.priorityRank]} `}
                        {b.productName} · Batch {b.batchNumber}
                      </p>
                      <p className="text-muted-foreground">
                        {b.batchSize} {b.batchSizeUnit} · {b.trayCount} trays · {daysSinceProduction(b.dateEnteredDryingRoom)}{" "}
                        day{daysSinceProduction(b.dateEnteredDryingRoom) === 1 ? "" : "s"} · {STAGE_LABEL[b.currentStage]}
                      </p>
                    </div>
                  ))}
              </div>
            )}
            {operatorName && <p className="mt-1.5 text-[11px] text-muted-foreground">Operator: {operatorName}</p>}
          </Card>
        );
        })}
      </div>
    </div>
  );
}

function BayDetailModal({
  bay,
  allBays,
  employees,
  canManage,
  onClose,
}: {
  bay: Bay;
  allBays: Bay[];
  employees: Employee[];
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [purpose, setPurpose] = useState<DryingBayPurpose>(bay.purpose);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(bay.assignedEmployeeId ?? "");
  const [department, setDepartment] = useState(bay.department ?? "");
  const [comments, setComments] = useState(bay.comments ?? "");
  const [expectedFinishTime, setExpectedFinishTime] = useState(
    bay.expectedFinishTime ? bay.expectedFinishTime.slice(0, 16) : ""
  );
  const [showAddBatch, setShowAddBatch] = useState(false);

  function saveBayInfo() {
    setError("");
    startTransition(async () => {
      try {
        await updateBayPurpose(bay.id, {
          purpose,
          assignedEmployeeId: assignedEmployeeId || null,
          department: department || null,
          comments: comments || null,
          expectedFinishTime: expectedFinishTime || null,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save bay info.");
      }
    });
  }

  function setStage(batchId: string, stage: DryingStage) {
    setError("");
    startTransition(async () => {
      try {
        await updateBatchStage(batchId, stage);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update stage.");
      }
    });
  }

  function removeBatch(batchId: string) {
    if (!confirm("Remove this batch from the drying room? This cannot be undone.")) return;
    setError("");
    startTransition(async () => {
      try {
        await deleteBatch(batchId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove batch.");
      }
    });
  }

  function moveBatch(batchId: string, bayId: string) {
    setError("");
    startTransition(async () => {
      try {
        await moveBatchToBay(batchId, bayId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't move batch.");
      }
    });
  }

  function setPriority(batchId: string, priorityRank: number | null) {
    setError("");
    startTransition(async () => {
      try {
        await updateBatchPriority(batchId, priorityRank);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't set priority.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Bay {bay.bayNumber}</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              General Information
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Purpose</span>
                <select value={purpose} onChange={(e) => setPurpose(e.target.value as DryingBayPurpose)} className="input">
                  {PURPOSE_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {PURPOSE_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Assigned Operator</span>
                <select value={assignedEmployeeId} onChange={(e) => setAssignedEmployeeId(e.target.value)} className="input">
                  <option value="">Unassigned</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Assigned Department</span>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Packaging"
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Expected Finish Time</span>
                <input
                  type="datetime-local"
                  value={expectedFinishTime}
                  onChange={(e) => setExpectedFinishTime(e.target.value)}
                  className="input"
                />
              </label>
              <label className="col-span-2 block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Comments</span>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={2}
                  placeholder="Notes for this bay..."
                  className="input"
                />
              </label>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Last updated {formatBrisbaneDateTime(bay.updatedAt)}</p>
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={saveBayInfo} disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                Batches ({bay.batches.length})
              </p>
              <Button size="sm" variant="secondary" onClick={() => setShowAddBatch(true)}>
                + Add Batch
              </Button>
            </div>

            {bay.batches.length === 0 ? (
              <p className="text-xs text-muted-foreground">No batches in this bay.</p>
            ) : (
              <div className="space-y-3">
                {bay.batches.map((batch) => (
                  <BatchCard
                    key={batch.id}
                    batch={batch}
                    otherBays={allBays.filter((b) => b.id !== bay.id)}
                    employees={employees}
                    canManage={canManage}
                    onSetStage={setStage}
                    onRemove={removeBatch}
                    onMoveBay={moveBatch}
                    onSetPriority={setPriority}
                    onRefresh={() => router.refresh()}
                  />
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        {showAddBatch && (
          <AddBatchModal
            bayId={bay.id}
            employees={employees}
            onClose={() => setShowAddBatch(false)}
            onCreated={() => {
              setShowAddBatch(false);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

function BatchCard({
  batch,
  otherBays,
  employees,
  canManage,
  onSetStage,
  onRemove,
  onMoveBay,
  onSetPriority,
  onRefresh,
}: {
  batch: Batch;
  otherBays: Bay[];
  employees: Employee[];
  canManage: boolean;
  onSetStage: (batchId: string, stage: DryingStage) => void;
  onRemove: (batchId: string) => void;
  onMoveBay: (batchId: string, bayId: string) => void;
  onSetPriority: (batchId: string, priorityRank: number | null) => void;
  onRefresh: () => void;
}) {
  const [showTrolleys, setShowTrolleys] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [stageTarget, setStageTarget] = useState("");
  const actions = STAGE_ACTIONS[batch.currentStage] ?? [];
  const alerts = computeBatchAlerts(batch);
  const days = daysSinceProduction(batch.dateEnteredDryingRoom);

  return (
    <div className="rounded-lg border border-border bg-surface-muted/40 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">
            {batch.priorityRank && `${PRIORITY_BADGE[batch.priorityRank]} `}
            {batch.productName} · Batch {batch.batchNumber}
          </p>
          <p className="text-muted-foreground">
            {batch.batchSize} {batch.batchSizeUnit} · {batch.numberOfTrolleys} trolleys · {batch.trayCount} trays · {days} day
            {days === 1 ? "" : "s"}
          </p>
          <p className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground">
              {STAGE_LABEL[batch.currentStage]}
            </span>
            {batch.priorityRank && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {PRIORITY_LABEL[batch.priorityRank]}
              </span>
            )}
          </p>
        </div>
        {canManage && (
          <button onClick={() => onRemove(batch.id)} className="text-[11px] font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-danger">
            Remove
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <select
          value={batch.priorityRank ?? ""}
          onChange={(e) => onSetPriority(batch.id, e.target.value ? Number(e.target.value) : null)}
          className="input py-1 text-[11px]"
        >
          <option value="">No priority</option>
          <option value="1">1st Priority</option>
          <option value="2">2nd Priority</option>
          <option value="3">3rd Priority</option>
        </select>
      </div>

      {alerts.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {alerts.map((a) => (
            <span
              key={a.key}
              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                a.severity === "danger" ? "border-danger/30 bg-danger/10 text-danger" : "border-warning/30 bg-warning/10 text-warning"
              }`}
            >
              {a.key === "waiting-too-long" ? "Waiting Too Long" : a.label.split("—")[1]?.trim() ?? a.label}
            </span>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {actions.map((a) => (
            <Button key={a.target} size="sm" variant="secondary" onClick={() => onSetStage(batch.id, a.target)}>
              {a.label}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5">
        <select value={stageTarget} onChange={(e) => setStageTarget(e.target.value)} className="input py-1 text-[11px]">
          <option value="">Move to stage...</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="secondary"
          disabled={!stageTarget}
          onClick={() => {
            onSetStage(batch.id, stageTarget as DryingStage);
            setStageTarget("");
          }}
        >
          Set
        </Button>
      </div>

      {otherBays.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} className="input py-1 text-[11px]">
            <option value="">Move to bay...</option>
            {otherBays.map((b) => (
              <option key={b.id} value={b.id}>
                Bay {b.bayNumber}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!moveTarget}
            onClick={() => {
              onMoveBay(batch.id, moveTarget);
              setMoveTarget("");
            }}
          >
            Move
          </Button>
        </div>
      )}

      <button
        onClick={() => setShowTrolleys((s) => !s)}
        className="mt-2 text-[11px] font-medium text-primary hover:underline"
      >
        {showTrolleys ? "Hide" : "Show"} {batch.trolleys.length} trolley record{batch.trolleys.length === 1 ? "" : "s"}
      </button>

      {showTrolleys && (
        <div className="mt-2 space-y-1.5">
          {batch.trolleys.map((t) => (
            <TrolleyRow key={t.id} trolley={t} employees={employees} onSaved={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrolleyRow({
  trolley,
  employees,
  onSaved,
}: {
  trolley: Trolley;
  employees: Employee[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState<number | "">(trolley.quantity ?? "");
  const [trayCount, setTrayCount] = useState<number | "">(trolley.trayCount ?? "");
  const [wrapped, setWrapped] = useState(trolley.wrapped);
  const [rotationCompleted, setRotationCompleted] = useState(trolley.rotationCompleted);
  const [qcStatus, setQcStatus] = useState<TrolleyQcStatus>(trolley.qcStatus);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(trolley.assignedEmployeeId ?? "");
  const [remarks, setRemarks] = useState(trolley.remarks ?? "");

  function save() {
    startTransition(async () => {
      await updateTrolley(trolley.id, {
        quantity: quantity === "" ? null : Number(quantity),
        trayCount: trayCount === "" ? null : Number(trayCount),
        wrapped,
        rotationCompleted,
        qcStatus,
        assignedEmployeeId: assignedEmployeeId || null,
        remarks: remarks || null,
      });
      onSaved();
    });
  }

  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground">Trolley {trolley.trolleyNumber}</span>
        <Button size="sm" variant="secondary" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Qty"
          className="input py-1 text-[11px]"
        />
        <input
          type="number"
          value={trayCount}
          onChange={(e) => setTrayCount(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Trays"
          className="input py-1 text-[11px]"
        />
        <select value={qcStatus} onChange={(e) => setQcStatus(e.target.value as TrolleyQcStatus)} className="input py-1 text-[11px]">
          <option value="PENDING">QC Pending</option>
          <option value="PASSED">QC Passed</option>
          <option value="FAILED">QC Failed</option>
        </select>
        <select value={assignedEmployeeId} onChange={(e) => setAssignedEmployeeId(e.target.value)} className="input py-1 text-[11px]">
          <option value="">Unassigned</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1 text-[11px] text-foreground">
          <input type="checkbox" checked={wrapped} onChange={(e) => setWrapped(e.target.checked)} />
          Wrapped
        </label>
        <label className="flex items-center gap-1 text-[11px] text-foreground">
          <input type="checkbox" checked={rotationCompleted} onChange={(e) => setRotationCompleted(e.target.checked)} />
          Rotation Completed
        </label>
        <input
          type="text"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Remarks"
          className="input min-w-[120px] flex-1 py-1 text-[11px]"
        />
      </div>
    </div>
  );
}

function AddBatchModal({
  bayId,
  employees,
  onClose,
  onCreated,
}: {
  bayId: string;
  employees: Employee[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [productName, setProductName] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [batchSize, setBatchSize] = useState(0);
  const [batchSizeUnit, setBatchSizeUnit] = useState("kg");
  const [numberOfTrolleys, setNumberOfTrolleys] = useState(1);
  const [trayCount, setTrayCount] = useState(0);
  const [dateEnteredDryingRoom, setDateEnteredDryingRoom] = useState(toDateInputValue(new Date()));
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
  const [priorityRank, setPriorityRank] = useState("");

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        await createBatch(bayId, {
          productName,
          batchNumber,
          batchSize,
          batchSizeUnit,
          numberOfTrolleys,
          trayCount,
          dateEnteredDryingRoom,
          dryingStartTime: new Date().toISOString(),
          assignedEmployeeId: assignedEmployeeId || null,
          priorityRank: priorityRank ? Number(priorityRank) : null,
        });
        onCreated();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add batch.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Add Batch</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Product Name</span>
            <input value={productName} onChange={(e) => setProductName(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Batch Number</span>
            <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Batch Size</span>
              <input type="number" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Unit</span>
              <input value={batchSizeUnit} onChange={(e) => setBatchSizeUnit(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Trolleys</span>
              <input
                type="number"
                min={1}
                value={numberOfTrolleys}
                onChange={(e) => setNumberOfTrolleys(Number(e.target.value))}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Tray Count</span>
              <input type="number" value={trayCount} onChange={(e) => setTrayCount(Number(e.target.value))} className="input" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Date Entered Drying Room</span>
            <input
              type="date"
              value={dateEnteredDryingRoom}
              onChange={(e) => setDateEnteredDryingRoom(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Assigned Operator</span>
            <select value={assignedEmployeeId} onChange={(e) => setAssignedEmployeeId(e.target.value)} className="input">
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Priority</span>
            <select value={priorityRank} onChange={(e) => setPriorityRank(e.target.value)} className="input">
              <option value="">None</option>
              <option value="1">1st Priority</option>
              <option value="2">2nd Priority</option>
              <option value="3">3rd Priority</option>
            </select>
          </label>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !productName || !batchNumber}>
              {pending ? "Adding..." : "Add Batch"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiscStorageTab({ items, canManage }: { items: MiscItem[]; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<MiscItem | "new" | null>(null);

  function remove(id: string) {
    if (!confirm("Remove this storage item? This cannot be undone.")) return;
    deleteMiscStorageItem(id).then(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Miscellaneous Storage</h2>
        <Button size="sm" onClick={() => setEditing("new")}>
          + Add Item
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface">
          <EmptyState title="No items in miscellaneous storage." />
        </div>
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={THEAD_ROW_CLASS}>
                <Th>Product</Th>
                <Th>Batch</Th>
                <Th>Quantity</Th>
                <Th>Storage Type</Th>
                <Th>Status</Th>
                <Th>Required Action</Th>
                <Th>Location</Th>
                <Th>Updated</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{item.product}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.batchNumber ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{item.quantityLabel}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.storageType ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.status ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.requiredAction ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.location ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatBrisbaneDateTime(item.updatedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEditing(item)} className="mr-2 font-medium text-primary hover:underline">
                      Edit
                    </button>
                    {canManage && (
                      <button onClick={() => remove(item.id)} className="font-medium text-muted-foreground hover:text-danger">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && (
        <MiscItemModal
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function MiscItemModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: MiscItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [product, setProduct] = useState(existing?.product ?? "");
  const [batchNumber, setBatchNumber] = useState(existing?.batchNumber ?? "");
  const [quantityLabel, setQuantityLabel] = useState(existing?.quantityLabel ?? "");
  const [storageType, setStorageType] = useState(existing?.storageType ?? "");
  const [status, setStatus] = useState(existing?.status ?? "");
  const [requiredAction, setRequiredAction] = useState(existing?.requiredAction ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [remarks, setRemarks] = useState(existing?.remarks ?? "");

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        await upsertMiscStorageItem(existing?.id ?? null, {
          product,
          batchNumber: batchNumber || null,
          quantityLabel,
          storageType: storageType || null,
          status: status || null,
          requiredAction: requiredAction || null,
          location: location || null,
          remarks: remarks || null,
        });
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save item.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated w-full max-w-sm rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{existing ? "Edit" : "Add"} Storage Item</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Product</span>
            <input value={product} onChange={(e) => setProduct(e.target.value)} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Batch Number</span>
              <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Quantity</span>
              <input
                value={quantityLabel}
                onChange={(e) => setQuantityLabel(e.target.value)}
                placeholder="e.g. 0.5 Trolley"
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Storage Type</span>
              <input value={storageType} onChange={(e) => setStorageType(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Status</span>
              <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="e.g. Wrapped" className="input" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Required Action</span>
            <input value={requiredAction} onChange={(e) => setRequiredAction(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Remarks</span>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="input" />
          </label>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !product || !quantityLabel}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MorningReportTab({
  bays,
  misc,
  whatsAppGroups,
}: {
  bays: Bay[];
  misc: MiscItem[];
  whatsAppGroups: WhatsAppGroupOpt[];
}) {
  const [pending, startTransition] = useTransition();
  const [sendMode, setSendMode] = useState<"group" | "number">("group");
  const [groupId, setGroupId] = useState(whatsAppGroups[0]?.id ?? "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sendResult, setSendResult] = useState("");
  const [error, setError] = useState("");

  const reportText = useMemo(
    () =>
      generateMorningReportText(
        bays.map((b) => ({ bayNumber: b.bayNumber, purpose: b.purpose, batches: b.batches })),
        misc.map((m) => ({ product: m.product, quantityLabel: m.quantityLabel, status: m.status }))
      ),
    [bays, misc]
  );

  function send() {
    setError("");
    setSendResult("");
    startTransition(async () => {
      try {
        const result = await sendMorningReportToWhatsApp(
          sendMode === "group" ? { groupId, phoneNumber: null } : { groupId: null, phoneNumber }
        );
        setSendResult(
          result.sent
            ? `Sent to "${result.target}" via WhatsApp.`
            : `Sent to "${result.target}" (recorded in Audit Trail — WhatsApp isn't connected yet, so no real message went out).`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send report.");
      }
    });
  }

  const canSend = sendMode === "group" ? !!groupId : phoneNumber.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Reports</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">
            <button
              onClick={() => setSendMode("group")}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors duration-150 ease-out ${
                sendMode === "group" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Group
            </button>
            <button
              onClick={() => setSendMode("number")}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors duration-150 ease-out ${
                sendMode === "number" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Number
            </button>
          </div>
          {sendMode === "group" ? (
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="input py-1 text-xs">
              {whatsAppGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Phone number or wa.me link"
              className="input py-1 text-xs"
            />
          )}
          <Button size="sm" onClick={send} disabled={pending || !canSend}>
            {pending ? "Sending..." : "Send to WhatsApp"}
          </Button>
        </div>
      </div>
      {sendResult && <p className="text-xs text-success">{sendResult}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
      <Card padding="md">
        <pre className="whitespace-pre-wrap text-xs text-foreground">{reportText}</pre>
      </Card>
    </div>
  );
}
