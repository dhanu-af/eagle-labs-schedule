import { getSession, canManageWeeklyKpi } from "@/lib/auth";
import { listWeeklyKpiScorecards, computeWeeklyKpiSuggestions } from "@/lib/actions/weekly-kpi-actions";
import { currentWeekEnding } from "@/lib/week-utils";
import WeeklyKpiClient from "./weekly-kpi-client";

export default async function WeeklyKpiPage() {
  const session = await getSession();
  const canManage = !!session && canManageWeeklyKpi(session.role);

  const [scorecards, initialSuggestions] = await Promise.all([
    listWeeklyKpiScorecards(),
    // Pre-computed automatically on page load so "Record This Week" opens already
    // filled in -- no manual "Suggest values" click needed. Safe to skip entirely
    // when the viewer can't manage scorecards, since computeWeeklyKpiSuggestions
    // itself requires that access.
    canManage ? computeWeeklyKpiSuggestions(currentWeekEnding().toISOString()) : Promise.resolve(null),
  ]);

  return (
    <WeeklyKpiClient
      scorecards={scorecards.map((s) => ({
        id: s.id,
        weekEnding: s.weekEnding.toISOString(),
        otifPct: s.otifPct,
        scheduleAdherencePct: s.scheduleAdherencePct,
        materialAvailabilityPct: s.materialAvailabilityPct,
        productionAttainmentPct: s.productionAttainmentPct,
        averageYieldPct: s.averageYieldPct,
        qcOnTimeReleasePct: s.qcOnTimeReleasePct,
        inventoryAccuracyPct: s.inventoryAccuracyPct,
        pastDueOrders: s.pastDueOrders,
        criticalShortages: s.criticalShortages,
        unplannedScheduleChanges: s.unplannedScheduleChanges,
        overallStatus: s.overallStatus,
        managementComment: s.managementComment,
        autoUpdateComputed: s.autoUpdateComputed,
        createdByName: s.createdByName,
      }))}
      initialSuggestions={initialSuggestions}
      canManage={canManage}
    />
  );
}
