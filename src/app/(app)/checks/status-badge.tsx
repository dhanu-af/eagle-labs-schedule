import type { CheckStatus } from "@/generated/prisma";

const CLASS: Record<CheckStatus, string> = {
  PENDING: "bg-warning/10 text-warning border-warning/30",
  IN_PROGRESS: "bg-info/10 text-info border-info/30",
  COMPLETED: "bg-success/10 text-success border-success/30",
  APPROVED: "bg-primary/10 text-primary border-primary/30",
};

const LABEL: Record<CheckStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  APPROVED: "Approved",
};

export const STATUS_BADGE: Record<CheckStatus, React.ReactNode> = Object.fromEntries(
  (Object.keys(LABEL) as CheckStatus[]).map((s) => [
    s,
    <span key={s} className={`rounded-full border px-2 py-0.5 text-xs font-medium ${CLASS[s]}`}>
      {LABEL[s]}
    </span>,
  ])
) as Record<CheckStatus, React.ReactNode>;
