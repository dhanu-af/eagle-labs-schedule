import { getSession, canManageWeeklyKpi } from "@/lib/auth";
import { listWeeklyKpiScorecards } from "@/lib/actions/weekly-kpi-actions";
import WeeklyKpiClient from "./weekly-kpi-client";

export default async function WeeklyKpiPage() {
  const session = await getSession();
  const scorecards = await listWeeklyKpiScorecards();

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
        createdByName: s.createdByName,
      }))}
      canManage={!!session && canManageWeeklyKpi(session.role)}
    />
  );
}
