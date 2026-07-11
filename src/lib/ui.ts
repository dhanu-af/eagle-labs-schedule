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

export function toDateInputValue(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function pct(actual: number, target: number) {
  if (!target) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}
