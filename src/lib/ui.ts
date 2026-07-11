import type { AttendanceStatus, KbCategory, LeaveStatus, Priority, TaskStatus } from "@/generated/prisma";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  RUNNING: "Running",
  COMPLETED: "Completed",
  DELAYED: "Delayed",
};

export const STATUS_CLASS: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-surface-muted text-muted-foreground border-border",
  RUNNING: "bg-info/10 text-info border-info/30",
  COMPLETED: "bg-success/10 text-success border-success/30",
  DELAYED: "bg-danger/10 text-danger border-danger/30",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  CRITICAL: "bg-danger/10 text-danger border-danger/30",
  HIGH: "bg-warning/10 text-warning border-warning/30",
  MEDIUM: "bg-info/10 text-info border-info/30",
  LOW: "bg-surface-muted text-muted-foreground border-border",
};

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  LEAVE: "Leave",
};

export const ATTENDANCE_CLASS: Record<AttendanceStatus, string> = {
  PRESENT: "bg-success/10 text-success border-success/30",
  ABSENT: "bg-danger/10 text-danger border-danger/30",
  HALF_DAY: "bg-warning/10 text-warning border-warning/30",
  LEAVE: "bg-info/10 text-info border-info/30",
};

export const LEAVE_STATUS_CLASS: Record<LeaveStatus, string> = {
  PENDING: "bg-warning/10 text-warning border-warning/30",
  APPROVED: "bg-success/10 text-success border-success/30",
  REJECTED: "bg-danger/10 text-danger border-danger/30",
};

export const KB_CATEGORY_LABEL: Record<KbCategory, string> = {
  BLENDING_SOP: "Blending SOP",
  MACHINE_TROUBLESHOOTING: "Machine Troubleshooting",
  MAINTENANCE_CLEANING: "Maintenance & Cleaning",
  SAFETY: "Safety",
  PARTS: "Parts & Tooling",
};

export const KB_CATEGORY_CLASS: Record<KbCategory, string> = {
  BLENDING_SOP: "bg-info/10 text-info border-info/30",
  MACHINE_TROUBLESHOOTING: "bg-warning/10 text-warning border-warning/30",
  MAINTENANCE_CLEANING: "bg-success/10 text-success border-success/30",
  SAFETY: "bg-danger/10 text-danger border-danger/30",
  PARTS: "bg-surface-muted text-muted-foreground border-border",
};

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

// Brisbane (AEST) has no daylight saving — it's always UTC+10, year-round.
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;

/**
 * The current instant, shifted so its UTC-based getters/setters read as
 * Australia/Brisbane wall-clock time. Using Date.now() (a true, timezone-agnostic
 * UTC epoch) plus a fixed offset means this gives the identical answer whether the
 * process's local timezone is Brisbane (local dev) or UTC (Vercel production) —
 * unlike `new Date()` + `.setHours()`, which depends on the runtime's local TZ and
 * can be a day off in production.
 */
export function nowInBrisbane(): Date {
  return new Date(Date.now() + BRISBANE_OFFSET_MS);
}

/** Midnight today in Brisbane, as a Date with zeroed UTC fields (safe for Prisma date-range queries). */
export function todayInBrisbane(): Date {
  const d = nowInBrisbane();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Formats a Date produced by nowInBrisbane()/todayInBrisbane(). Must read it back
 * as UTC (timeZone: "UTC") rather than the runtime's local zone, or the value would
 * get shifted a second time on a machine whose local TZ actually is Brisbane.
 */
export function formatBrisbaneDate(d: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Formats a real timestamp (e.g. a signature time) as Brisbane wall-clock time, e.g. "9:15 am". */
export function formatBrisbaneTime(d: Date | string) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Brisbane",
  })
    .format(typeof d === "string" ? new Date(d) : d)
    .toLowerCase();
}

export function toDateInputValue(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Same as toDateInputValue, but for dates produced by nowInBrisbane()/todayInBrisbane() — reads UTC fields directly. */
export function toDateInputValueUTC(d: Date) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function pct(actual: number, target: number) {
  if (!target) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}
