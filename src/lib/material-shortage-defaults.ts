import type { EscalationLevel, ActionLogStatus } from "@/generated/prisma";

export const ESCALATION_LEVEL_LABELS: Record<EscalationLevel, string> = {
  GREEN: "Green",
  AMBER: "Amber",
  RED: "Red",
};

export const WATCH_STATUS_LABELS: Record<ActionLogStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/** Risk level from how soon the earliest affected order needs the material --
 * same 7-day "at risk" threshold computeOrderRisk() already uses elsewhere, with
 * an added Amber warning band so a shortage doesn't jump straight from fine to
 * critical with no notice. */
export function computeShortageRiskLevel(earliestNeedDate: Date): EscalationLevel {
  const daysToNeed = (earliestNeedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysToNeed <= 7) return "RED";
  if (daysToNeed <= 14) return "AMBER";
  return "GREEN";
}
