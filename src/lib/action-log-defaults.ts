import type { ActionSourceSection, ActionLogStatus, EscalationLevel, Priority } from "@/generated/prisma";

export const SOURCE_SECTION_LABELS: Record<ActionSourceSection, string> = {
  SALES_CUSTOMER_SERVICE: "Sales / Customer Service",
  PRODUCTION_PLANNING: "Production Planning",
  PROCUREMENT_MATERIALS: "Procurement / Materials",
  WAREHOUSE: "Warehouse",
  QC_QA: "QC / QA",
  MAINTENANCE_ENGINEERING: "Maintenance / Engineering",
  PRODUCTION_SHIFTS: "Production / Shifts",
  DISPATCH_DELIVERY: "Dispatch / Delivery",
  CROSS_FUNCTIONAL: "Cross-Functional",
};

export const ACTION_LOG_STATUS_LABELS: Record<ActionLogStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const ESCALATION_LEVEL_LABELS: Record<EscalationLevel, string> = {
  GREEN: "Green — manage normally",
  AMBER: "Amber — action required",
  RED: "Red — immediate escalation",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

/** An action still counts as open work for dashboard/badge purposes unless resolved or closed. */
export function isOpenActionStatus(status: ActionLogStatus): boolean {
  return status !== "RESOLVED" && status !== "CLOSED";
}

/** Days between when an action was raised and now (or its closed date, once closed) --
 * never stored, always computed at render, matching the risk-computation precedent in
 * customer-order-defaults.ts. */
export function computeDaysOpen(dateRaised: Date | string, closedDate: Date | string | null): number {
  const start = new Date(dateRaised).getTime();
  const end = closedDate ? new Date(closedDate).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

/** An open action is overdue once today passes its due date. */
export function isActionOverdue(dueDate: Date | string | null, status: ActionLogStatus): boolean {
  if (!dueDate || !isOpenActionStatus(status)) return false;
  return new Date(dueDate).getTime() < Date.now();
}
