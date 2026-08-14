"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import OverviewTab from "./overview-tab";
import MachinesTab from "./machines-tab";
import UnscheduledTab from "./unscheduled-tab";
import WeeklyRollupTab from "./weekly-rollup-tab";
import type { CapacityOverviewRow, CapacityWeeklyRow } from "@/lib/actions/capacity-planning-actions";

export type CapacityExceptionRow = { id: string; date: string; hoursAvailableOverride: number; reason: string | null };
export type MachineRow = {
  id: string;
  code: string;
  name: string;
  workCenter: string | null;
  standardHoursPerDay: number;
  notes: string | null;
  active: boolean;
  capacityExceptions: CapacityExceptionRow[];
};
export type UnscheduledBatchRow = { id: string; productName: string; batchNumber: string; status: string; createdAt: string };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "weeklyRollup", label: "Weekly Rollup" },
  { key: "machines", label: "Machines" },
  { key: "unscheduled", label: "Unscheduled Batches" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function CapacityPlanningClient({
  machines,
  unscheduled,
  overview,
  weeklyRollup,
  canManage,
}: {
  machines: MachineRow[];
  unscheduled: UnscheduledBatchRow[];
  overview: { dateKeys: string[]; rows: CapacityOverviewRow[] };
  weeklyRollup: { weekEndings: string[]; rows: CapacityWeeklyRow[] };
  canManage: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="space-y-4">
      <PageHeader title="Capacity Planning" subtitle="Machine schedule and utilisation, computed from real scheduled batches — Phase 2." />

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
              tab === t.key ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab overview={overview} />}
      {tab === "weeklyRollup" && <WeeklyRollupTab rollup={weeklyRollup} canManage={canManage} />}
      {tab === "machines" && <MachinesTab machines={machines} canManage={canManage} />}
      {tab === "unscheduled" && <UnscheduledTab batches={unscheduled} machines={machines} canManage={canManage} />}
    </div>
  );
}
