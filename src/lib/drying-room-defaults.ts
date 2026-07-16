import type { DryingBayPurpose, DryingStage } from "@/generated/prisma";

export const PURPOSE_LABEL: Record<DryingBayPurpose, string> = {
  EMPTY: "Empty",
  DRYING: "Drying",
  WAITING_QC: "Waiting QC",
  READY_FOR_POUCHING: "Ready for Pouching",
  READY_FOR_PRODUCTION: "Ready for Production",
  CLEANING_REQUIRED: "Cleaning Required",
  RND: "R&D",
  STORAGE: "Storage",
  SERVICE: "Service",
  SORTING: "Sorting",
  QA_QC_APPROVALS: "QA/QC Approvals",
  POLISHING: "Polishing",
  COATING: "Coating",
  RE_COATING: "Re Coating",
  QUARANTINE: "Quarantine",
};

export const STAGE_LABEL: Record<DryingStage, string> = {
  RECEIVING: "Receiving",
  DRYING: "Drying",
  ROTATION_REQUIRED: "Rotation Required",
  CONTINUE_DRYING: "Continue Drying",
  QC_SAMPLING: "QC Sampling",
  QC_PENDING: "QC Pending",
  QC_APPROVED: "QC Approved",
  QC_HOLD: "QC Hold",
  WRAPPING: "Wrapping",
  READY_FOR_POUCHING: "Ready for Pouching",
  POUCHING: "Pouching",
  COMPLETE: "Complete",
};

/** Stage -> next stage, exactly matching the module spec's workflow table. Null = terminal (Complete). */
export const NEXT_STAGE: Record<DryingStage, DryingStage | null> = {
  RECEIVING: "DRYING",
  DRYING: "ROTATION_REQUIRED",
  ROTATION_REQUIRED: "CONTINUE_DRYING",
  CONTINUE_DRYING: "QC_SAMPLING",
  QC_SAMPLING: "QC_PENDING",
  QC_PENDING: "QC_APPROVED",
  QC_APPROVED: "WRAPPING",
  QC_HOLD: "QC_SAMPLING",
  WRAPPING: "READY_FOR_POUCHING",
  READY_FOR_POUCHING: "POUCHING",
  POUCHING: "COMPLETE",
  COMPLETE: null,
};

/** Bay status colour bucket, matching the module spec's "Bay Status Colours" legend. */
export type BayStatusKey =
  | "EMPTY"
  | "DRYING"
  | "ROTATION_REQUIRED"
  | "WAITING_QC"
  | "WRAPPED"
  | "READY_FOR_POUCHING"
  | "READY_FOR_PRODUCTION"
  | "CLEANING_REQUIRED"
  | "QC_HOLD"
  | "SERVICE"
  | "RND"
  | "SORTING"
  | "QA_QC_APPROVALS"
  | "POLISHING"
  | "COATING"
  | "RE_COATING"
  | "QUARANTINE";

export const BAY_STATUS_LABEL: Record<BayStatusKey, string> = {
  EMPTY: "Empty",
  DRYING: "Drying",
  ROTATION_REQUIRED: "Rotation Required",
  WAITING_QC: "Waiting QC",
  WRAPPED: "Wrapped",
  READY_FOR_POUCHING: "Ready for Pouching",
  READY_FOR_PRODUCTION: "Ready for Production",
  CLEANING_REQUIRED: "Cleaning Required",
  QC_HOLD: "QC Hold",
  SERVICE: "Service",
  RND: "R&D",
  SORTING: "Sorting",
  QA_QC_APPROVALS: "QA/QC Approvals",
  POLISHING: "Polishing",
  COATING: "Coating",
  RE_COATING: "Re Coating",
  QUARANTINE: "Quarantine",
};

export const BAY_STATUS_CLASS: Record<BayStatusKey, string> = {
  EMPTY: "bg-surface-muted text-muted-foreground border-border",
  DRYING: "bg-warning/10 text-warning border-warning/30",
  ROTATION_REQUIRED: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  WAITING_QC: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  WRAPPED: "bg-info/10 text-info border-info/30",
  READY_FOR_POUCHING: "bg-success/10 text-success border-success/30",
  READY_FOR_PRODUCTION: "bg-success/10 text-success border-success/30",
  CLEANING_REQUIRED: "bg-warning/10 text-warning border-warning/30",
  QC_HOLD: "bg-danger/10 text-danger border-danger/30",
  SERVICE: "bg-surface-muted text-muted-foreground border-border",
  RND: "bg-primary/10 text-primary border-primary/30",
  SORTING: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  QA_QC_APPROVALS: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  POLISHING: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  COATING: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  RE_COATING: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  QUARANTINE: "bg-danger/10 text-danger border-danger/30",
};

const STAGE_TO_BAY_STATUS: Partial<Record<DryingStage, BayStatusKey>> = {
  ROTATION_REQUIRED: "ROTATION_REQUIRED",
  QC_SAMPLING: "WAITING_QC",
  QC_PENDING: "WAITING_QC",
  QC_HOLD: "QC_HOLD",
  WRAPPING: "WRAPPED",
  READY_FOR_POUCHING: "READY_FOR_POUCHING",
};

const PURPOSE_TO_BAY_STATUS: Record<DryingBayPurpose, BayStatusKey> = {
  EMPTY: "EMPTY",
  DRYING: "DRYING",
  WAITING_QC: "WAITING_QC",
  READY_FOR_POUCHING: "READY_FOR_POUCHING",
  READY_FOR_PRODUCTION: "READY_FOR_PRODUCTION",
  CLEANING_REQUIRED: "CLEANING_REQUIRED",
  RND: "RND",
  STORAGE: "SERVICE",
  SERVICE: "SERVICE",
  SORTING: "SORTING",
  QA_QC_APPROVALS: "QA_QC_APPROVALS",
  POLISHING: "POLISHING",
  COATING: "COATING",
  RE_COATING: "RE_COATING",
  QUARANTINE: "QUARANTINE",
};

/** Named quick-action buttons valid from each stage, matching the module spec's Quick Actions list. */
export const STAGE_ACTIONS: Partial<Record<DryingStage, { label: string; target: DryingStage }[]>> = {
  RECEIVING: [{ label: "Start Drying", target: "DRYING" }],
  DRYING: [
    { label: "Rotation Required", target: "ROTATION_REQUIRED" },
    { label: "Request QC", target: "QC_SAMPLING" },
  ],
  ROTATION_REQUIRED: [{ label: "Rotation Completed", target: "CONTINUE_DRYING" }],
  CONTINUE_DRYING: [{ label: "Request QC", target: "QC_SAMPLING" }],
  QC_SAMPLING: [{ label: "Move to QC Pending", target: "QC_PENDING" }],
  QC_PENDING: [
    { label: "QC Passed", target: "QC_APPROVED" },
    { label: "QC Failed", target: "QC_HOLD" },
  ],
  QC_HOLD: [{ label: "Resample", target: "QC_SAMPLING" }],
  QC_APPROVED: [{ label: "Wrapped", target: "WRAPPING" }],
  WRAPPING: [{ label: "Ready for Pouching", target: "READY_FOR_POUCHING" }],
  READY_FOR_POUCHING: [{ label: "Send to Pouching", target: "POUCHING" }],
  POUCHING: [{ label: "Mark Complete", target: "COMPLETE" }],
};

type BatchLike = { currentStage: DryingStage };

/** Bay's current status is driven by its most urgent active batch, falling back to its manually-set purpose when empty. */
export function computeBayStatus(purpose: DryingBayPurpose, activeBatches: BatchLike[]): BayStatusKey {
  if (activeBatches.length === 0) return PURPOSE_TO_BAY_STATUS[purpose];

  const priority: BayStatusKey[] = ["QC_HOLD", "ROTATION_REQUIRED", "WAITING_QC", "READY_FOR_POUCHING", "WRAPPED"];
  const statuses = activeBatches.map((b) => STAGE_TO_BAY_STATUS[b.currentStage] ?? "DRYING");
  for (const p of priority) {
    if (statuses.includes(p)) return p;
  }
  return statuses[0] ?? "DRYING";
}

// Alert thresholds (hours) -- tune here as real-world drying/QC timings become clear.
export const ROTATION_OVERDUE_HOURS = 12;
export const DRYING_TIME_EXCEEDED_HOURS = 72;
export const BATCH_WAITING_TOO_LONG_HOURS = 24;

export type DryingAlert = {
  key: string;
  label: string;
  severity: "warning" | "danger";
};

function hoursSince(d: Date | string): number {
  return (Date.now() - new Date(d).getTime()) / 3_600_000;
}

/** Pure, read-only alerts derived from current state -- nothing here is stored. */
export function computeBatchAlerts(batch: {
  productName: string;
  batchNumber: string;
  currentStage: DryingStage;
  stageUpdatedAt: Date | string;
  dryingStartTime: Date | string | null;
}): DryingAlert[] {
  const alerts: DryingAlert[] = [];
  const label = `${batch.productName} · ${batch.batchNumber}`;

  if (batch.currentStage === "QC_SAMPLING" || batch.currentStage === "QC_PENDING") {
    alerts.push({ key: "qc-required", label: `${label} — QC Required`, severity: "warning" });
  }
  if (batch.currentStage === "QC_HOLD") {
    alerts.push({ key: "qc-hold", label: `${label} — QC Hold`, severity: "danger" });
  }
  if (batch.currentStage === "ROTATION_REQUIRED" && hoursSince(batch.stageUpdatedAt) > ROTATION_OVERDUE_HOURS) {
    alerts.push({ key: "rotation-overdue", label: `${label} — Rotation Overdue`, severity: "danger" });
  }
  if (batch.dryingStartTime && (batch.currentStage === "DRYING" || batch.currentStage === "CONTINUE_DRYING")) {
    if (hoursSince(batch.dryingStartTime) > DRYING_TIME_EXCEEDED_HOURS) {
      alerts.push({ key: "drying-exceeded", label: `${label} — Drying Time Exceeded`, severity: "danger" });
    }
  }
  if (batch.currentStage === "READY_FOR_POUCHING") {
    alerts.push({ key: "ready-for-pouching", label: `${label} — Ready for Pouching`, severity: "warning" });
  }
  if (hoursSince(batch.stageUpdatedAt) > BATCH_WAITING_TOO_LONG_HOURS && batch.currentStage !== "COMPLETE") {
    alerts.push({ key: "waiting-too-long", label: `${label} — Waiting Too Long in ${STAGE_LABEL[batch.currentStage]}`, severity: "warning" });
  }
  return alerts;
}

export function computeBayAlerts(bayNumber: number, purpose: DryingBayPurpose, activeBatches: unknown[]): DryingAlert[] {
  const alerts: DryingAlert[] = [];
  if (purpose === "CLEANING_REQUIRED") {
    alerts.push({ key: "cleaning-required", label: `Bay ${bayNumber} — Cleaning Required`, severity: "warning" });
  }
  if (purpose === "EMPTY" && activeBatches.length === 0) {
    alerts.push({ key: "bay-empty", label: `Bay ${bayNumber} — Empty`, severity: "warning" });
  }
  return alerts;
}
