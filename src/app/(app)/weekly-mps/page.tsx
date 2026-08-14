import { prisma } from "@/lib/prisma";
import { getSession, canManageWeeklyMps } from "@/lib/auth";
import { listWeeklyMpsEntries } from "@/lib/actions/weekly-mps-actions";
import { getCapacityWeeklyRollup } from "@/lib/actions/capacity-planning-actions";
import { currentWeekEnding, weekEndingFor } from "@/lib/week-utils";
import WeeklyMpsClient from "./weekly-mps-client";

function parseWeekEnding(input?: string) {
  if (input) {
    const d = new Date(`${input}T00:00:00`);
    if (!isNaN(d.getTime())) return weekEndingFor(d);
  }
  return currentWeekEnding();
}

export default async function WeeklyMpsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;
  const session = await getSession();
  const weekEnding = parseWeekEnding(weekParam);

  const [entries, products, machines, capacityRollup] = await Promise.all([
    listWeeklyMpsEntries(weekEnding.toISOString()),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true, formulationId: true } }),
    prisma.machine.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    getCapacityWeeklyRollup(weekEnding, 1),
  ]);

  // Read-only cross-reference to Capacity Planning's real machine schedule for this
  // same week -- lets a planner see if a line is already overloaded before committing
  // a batch to it. Deliberately one-way: MPS entries don't feed hours back into the
  // capacity math, so this can never double-count against BatchRecord's own scheduling.
  const capacityByMachine = Object.fromEntries(capacityRollup.rows.map((row) => [row.machineId, row.weeks[0]]));

  return (
    <WeeklyMpsClient
      weekEndingIso={weekEnding.toISOString()}
      capacityByMachine={capacityByMachine}
      entries={entries.map((e) => ({
        id: e.id,
        weekEnding: e.weekEnding.toISOString(),
        machineId: e.machineId,
        machineName: e.machine ? `${e.machine.name} (${e.machine.code})` : null,
        productId: e.productId,
        productName: e.product.name,
        productSku: e.product.sku,
        batchSizeKg: e.batchSizeKg,
        plannedBatches: e.plannedBatches,
        requiredDate: e.requiredDate ? e.requiredDate.toISOString() : null,
        priority: e.priority,
        frozen: e.frozen,
        qcReady: e.qcReady,
        maintenanceReady: e.maintenanceReady,
        notes: e.notes,
        createdByName: e.createdByName,
      }))}
      products={products}
      machines={machines}
      canManage={!!session && canManageWeeklyMps(session.role)}
    />
  );
}
