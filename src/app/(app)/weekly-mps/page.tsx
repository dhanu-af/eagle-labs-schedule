import { prisma } from "@/lib/prisma";
import { getSession, canManageWeeklyMps } from "@/lib/auth";
import { listWeeklyMpsEntries } from "@/lib/actions/weekly-mps-actions";
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

  const [entries, products, machines] = await Promise.all([
    listWeeklyMpsEntries(weekEnding.toISOString()),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true, formulationId: true } }),
    prisma.machine.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
  ]);

  return (
    <WeeklyMpsClient
      weekEndingIso={weekEnding.toISOString()}
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
