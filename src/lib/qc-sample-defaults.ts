import type { QcSampleStatus, QcSampleType } from "@/generated/prisma";

export const SAMPLE_TYPE_LABEL: Record<QcSampleType, string> = {
  FINISHED_PRODUCT: "Finished Product",
  STABILITY: "Stability",
  RETENTION: "Retention",
  INVESTIGATION: "Investigation",
  COMPLAINT: "Complaint",
};

export const SAMPLE_STATUS_LABEL: Record<QcSampleStatus, string> = {
  WAITING_COLLECTION: "Waiting Collection",
  COLLECTED: "Collected",
  WAITING_LAB: "Waiting Lab",
  IN_LABORATORY: "In Laboratory",
  TESTING: "Testing",
  WAITING_RESULTS: "Waiting Results",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RETENTION: "Retention",
  EXPIRED: "Expired",
  DISPOSED: "Disposed",
};

export type BadgeTone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

export const SAMPLE_STATUS_TONE: Record<QcSampleStatus, BadgeTone> = {
  WAITING_COLLECTION: "muted",
  COLLECTED: "info",
  WAITING_LAB: "warning",
  IN_LABORATORY: "info",
  TESTING: "primary",
  WAITING_RESULTS: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  RETENTION: "primary",
  EXPIRED: "danger",
  DISPOSED: "muted",
};

/** The sample statuses that count as "still open" -- i.e. not yet at a terminal outcome. */
export const OPEN_SAMPLE_STATUSES: QcSampleStatus[] = [
  "WAITING_COLLECTION",
  "COLLECTED",
  "WAITING_LAB",
  "IN_LABORATORY",
  "TESTING",
  "WAITING_RESULTS",
];

/** Statuses in the laboratory phase -- used for the "lab testing overdue" alert. */
export const IN_LAB_STATUSES: QcSampleStatus[] = ["IN_LABORATORY", "TESTING", "WAITING_RESULTS"];

/** Alert thresholds -- simple starting heuristics, tune once there's real usage data. */
export const RETENTION_EXPIRY_WARNING_DAYS = 30;
export const LAB_TESTING_OVERDUE_DAYS = 5;
export const LOW_QUANTITY_THRESHOLD = 10;

/** `QC-2026-000124` -- year of creation + the row's autoincrement `sequence`, padded to 6 digits. Stored at creation so it never changes even if formatting rules do later. */
export function formatSampleId(sequence: number, createdAt: Date = new Date()): string {
  const year = createdAt.getFullYear();
  return `QC-${year}-${String(sequence).padStart(6, "0")}`;
}

/** Days until expiry/destroy (negative = already past). Null when there's no date. */
export function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}
