import type { EscalationLevel } from "@/generated/prisma";

export { weekEndingFor, currentWeekEnding, weekBounds, formatWeekLabel, roundPct } from "@/lib/week-utils";

export const ESCALATION_LEVEL_LABELS: Record<EscalationLevel, string> = {
  GREEN: "Green",
  AMBER: "Amber",
  RED: "Red",
};

export type ScorecardFieldKey =
  | "otifPct"
  | "scheduleAdherencePct"
  | "materialAvailabilityPct"
  | "productionAttainmentPct"
  | "averageYieldPct"
  | "qcOnTimeReleasePct"
  | "inventoryAccuracyPct"
  | "pastDueOrders"
  | "criticalShortages"
  | "unplannedScheduleChanges";

export const SCORECARD_FIELDS: { key: ScorecardFieldKey; label: string; unit: "%" | "count"; source: "computed" | "manual" }[] = [
  { key: "otifPct", label: "OTIF %", unit: "%", source: "computed" },
  { key: "pastDueOrders", label: "Past-Due Orders", unit: "count", source: "computed" },
  { key: "materialAvailabilityPct", label: "Material Availability %", unit: "%", source: "computed" },
  { key: "criticalShortages", label: "Critical Shortages", unit: "count", source: "computed" },
  { key: "productionAttainmentPct", label: "Production Attainment %", unit: "%", source: "computed" },
  { key: "averageYieldPct", label: "Average Yield %", unit: "%", source: "computed" },
  { key: "scheduleAdherencePct", label: "Schedule Adherence %", unit: "%", source: "manual" },
  { key: "unplannedScheduleChanges", label: "Unplanned Schedule Changes", unit: "count", source: "manual" },
  { key: "qcOnTimeReleasePct", label: "QC On-Time Release %", unit: "%", source: "manual" },
  { key: "inventoryAccuracyPct", label: "Inventory Accuracy %", unit: "%", source: "manual" },
];
