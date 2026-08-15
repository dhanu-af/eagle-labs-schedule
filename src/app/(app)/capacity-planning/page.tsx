import { getSession, canManageCapacityPlanning } from "@/lib/auth";
import { listMachines, getUnscheduledBatchRecords, getCapacityOverview, getCapacityWeeklyRollup } from "@/lib/actions/capacity-planning-actions";
import { listTaskRequestRecipients } from "@/lib/actions/task-request-actions";
import CapacityPlanningClient from "./capacity-planning-client";

export default async function CapacityPlanningPage() {
  const session = await getSession();

  const [machines, unscheduled, overview, weeklyRollup, taskRequestRecipients] = await Promise.all([
    listMachines(),
    getUnscheduledBatchRecords(),
    getCapacityOverview(new Date(), 14),
    getCapacityWeeklyRollup(new Date(), 4),
    listTaskRequestRecipients(),
  ]);

  return (
    <CapacityPlanningClient
      machines={machines.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        workCenter: m.workCenter,
        standardHoursPerDay: m.standardHoursPerDay,
        notes: m.notes,
        active: m.active,
        capacityExceptions: m.capacityExceptions.map((e) => ({ id: e.id, date: e.date.toISOString(), hoursAvailableOverride: e.hoursAvailableOverride, reason: e.reason })),
      }))}
      unscheduled={unscheduled.map((b) => ({ id: b.id, productName: b.productName, batchNumber: b.batchNumber, status: b.status, createdAt: b.createdAt.toISOString() }))}
      overview={overview}
      weeklyRollup={weeklyRollup}
      canManage={!!session && canManageCapacityPlanning(session.role)}
      taskRequestRecipients={taskRequestRecipients}
    />
  );
}
