"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManageCapacityPlanning } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toDateKey, addDays, computeMachineCapacity, type MachineCapacitySnapshot } from "@/lib/capacity-planning-defaults";

const BASE_PATH = "/capacity-planning";

async function requireAccess() {
  const session = await getSession();
  if (!session || !canManageCapacityPlanning(session.role)) throw new Error("Not authorized");
  return session;
}

function dayRange(date: Date) {
  const start = new Date(`${toDateKey(date)}T00:00:00.000Z`);
  const end = addDays(start, 1);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

export async function listMachines() {
  return prisma.machine.findMany({ orderBy: { name: "asc" }, include: { capacityExceptions: { orderBy: { date: "asc" } } } });
}

export async function createMachine(data: { code: string; name: string; workCenter?: string | null; standardHoursPerDay: number; notes?: string | null }) {
  const session = await requireAccess();
  if (!data.code.trim() || !data.name.trim()) throw new Error("Code and name are required");
  if (data.standardHoursPerDay <= 0) throw new Error("Standard hours per day must be greater than 0");

  const machine = await prisma.machine.create({ data: { ...data, code: data.code.trim(), name: data.name.trim() } });

  await logAudit(session, { action: "CREATE_MACHINE", entityType: "Machine", entityId: machine.id, summary: `Machine "${machine.name}" (${machine.code}) added` });
  revalidatePath(BASE_PATH);
  return machine;
}

export async function updateMachine(
  id: string,
  data: { code: string; name: string; workCenter?: string | null; standardHoursPerDay: number; notes?: string | null; active: boolean }
) {
  const session = await requireAccess();
  if (!data.code.trim() || !data.name.trim()) throw new Error("Code and name are required");
  if (data.standardHoursPerDay <= 0) throw new Error("Standard hours per day must be greater than 0");

  const machine = await prisma.machine.update({ where: { id }, data: { ...data, code: data.code.trim(), name: data.name.trim() } });

  await logAudit(session, { action: "UPDATE_MACHINE", entityType: "Machine", entityId: machine.id, summary: `Machine "${machine.name}" (${machine.code}) updated` });
  revalidatePath(BASE_PATH);
  return machine;
}

export async function addCapacityException(machineId: string, data: { date: string; hoursAvailableOverride: number; reason?: string | null }) {
  const session = await requireAccess();
  if (data.hoursAvailableOverride < 0) throw new Error("Available hours can't be negative");

  const exception = await prisma.machineCapacityException.upsert({
    where: { machineId_date: { machineId, date: new Date(data.date) } },
    create: { machineId, date: new Date(data.date), hoursAvailableOverride: data.hoursAvailableOverride, reason: data.reason },
    update: { hoursAvailableOverride: data.hoursAvailableOverride, reason: data.reason },
  });

  await logAudit(session, {
    action: "SET_MACHINE_CAPACITY_EXCEPTION",
    entityType: "Machine",
    entityId: machineId,
    summary: `Capacity override set for ${data.date}: ${data.hoursAvailableOverride}h${data.reason ? ` (${data.reason})` : ""}`,
  });
  revalidatePath(BASE_PATH);
  return exception;
}

export async function deleteCapacityException(id: string) {
  const session = await requireAccess();
  const exception = await prisma.machineCapacityException.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_MACHINE_CAPACITY_EXCEPTION",
    entityType: "Machine",
    entityId: exception.machineId,
    summary: `Capacity override for ${toDateKey(exception.date)} removed`,
  });
  revalidatePath(BASE_PATH);
}

// ---------------------------------------------------------------------------
// Capacity math
// ---------------------------------------------------------------------------

export async function getMachineCapacityForDate(machineId: string, date: Date): Promise<MachineCapacitySnapshot> {
  const { start, end } = dayRange(date);

  const [machine, exception, scheduled] = await Promise.all([
    prisma.machine.findUniqueOrThrow({ where: { id: machineId } }),
    prisma.machineCapacityException.findUnique({ where: { machineId_date: { machineId, date: start } } }),
    prisma.batchRecord.aggregate({
      where: { machineId, scheduledDate: { gte: start, lt: end } },
      _sum: { estimatedHours: true },
    }),
  ]);

  const availableHours = exception?.hoursAvailableOverride ?? machine.standardHoursPerDay;
  const scheduledHours = scheduled._sum.estimatedHours ?? 0;
  return computeMachineCapacity(availableHours, scheduledHours);
}

export type CapacityOverviewBatch = { id: string; batchNumber: string; productName: string; estimatedHours: number };
export type CapacityOverviewCell = MachineCapacitySnapshot & { batches: CapacityOverviewBatch[] };
export type CapacityOverviewRow = { machineId: string; code: string; name: string; workCenter: string | null; cells: Record<string, CapacityOverviewCell> };

/** Batches every machine's capacity for a date range into 3 queries total (machines,
 * exceptions in range, batch records in range) instead of one query per machine per day
 * -- same batching discipline as Phase 1's getOrderMaterialChecks. */
export async function getCapacityOverview(startDate: Date, days = 14): Promise<{ dateKeys: string[]; rows: CapacityOverviewRow[] }> {
  const rangeStart = new Date(`${toDateKey(startDate)}T00:00:00.000Z`);
  const rangeEnd = addDays(rangeStart, days);
  const dateKeys = Array.from({ length: days }, (_, i) => toDateKey(addDays(rangeStart, i)));

  const [machines, exceptions, batches] = await Promise.all([
    prisma.machine.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.machineCapacityException.findMany({ where: { date: { gte: rangeStart, lt: rangeEnd } } }),
    prisma.batchRecord.findMany({
      where: { machineId: { not: null }, scheduledDate: { gte: rangeStart, lt: rangeEnd } },
      select: { id: true, batchNumber: true, productName: true, estimatedHours: true, machineId: true, scheduledDate: true },
    }),
  ]);

  const exceptionsByMachineAndDate = new Map<string, number>();
  for (const e of exceptions) exceptionsByMachineAndDate.set(`${e.machineId}|${toDateKey(e.date)}`, e.hoursAvailableOverride);

  const rows: CapacityOverviewRow[] = machines.map((machine) => {
    const cells: Record<string, CapacityOverviewCell> = {};
    for (const dateKey of dateKeys) {
      const dayBatches = batches.filter((b) => b.machineId === machine.id && b.scheduledDate && toDateKey(b.scheduledDate) === dateKey);
      const availableHours = exceptionsByMachineAndDate.get(`${machine.id}|${dateKey}`) ?? machine.standardHoursPerDay;
      const scheduledHours = dayBatches.reduce((sum, b) => sum + (b.estimatedHours ?? 0), 0);
      cells[dateKey] = {
        ...computeMachineCapacity(availableHours, scheduledHours),
        batches: dayBatches.map((b) => ({ id: b.id, batchNumber: b.batchNumber, productName: b.productName, estimatedHours: b.estimatedHours ?? 0 })),
      };
    }
    return { machineId: machine.id, code: machine.code, name: machine.name, workCenter: machine.workCenter, cells };
  });

  return { dateKeys, rows };
}

// ---------------------------------------------------------------------------
// Scheduling -- the only place that writes machineId/scheduledDate/estimatedHours onto
// BatchRecord. Deliberately separate from batch-record-actions.ts and never touches or
// checks BatchRecord.locked -- scheduling is a planning concern, not GMP content.
// ---------------------------------------------------------------------------

export async function getUnscheduledBatchRecords() {
  return prisma.batchRecord.findMany({
    where: { machineId: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, productName: true, batchNumber: true, status: true, createdAt: true },
  });
}

export async function scheduleBatchRecord(batchRecordId: string, data: { machineId: string; scheduledDate: string; estimatedHours: number }) {
  const session = await requireAccess();
  if (!data.machineId) throw new Error("Machine is required");
  if (!data.estimatedHours || data.estimatedHours <= 0) throw new Error("Estimated hours must be greater than 0");

  const batch = await prisma.batchRecord.update({
    where: { id: batchRecordId },
    data: { machineId: data.machineId, scheduledDate: new Date(data.scheduledDate), estimatedHours: data.estimatedHours },
    include: { machine: true },
  });

  await logAudit(session, {
    action: "SCHEDULE_BATCH_RECORD",
    entityType: "BatchRecord",
    entityId: batch.id,
    summary: `Batch ${batch.batchNumber} (${batch.productName}) scheduled on ${batch.machine?.name} for ${data.scheduledDate}, ${data.estimatedHours}h`,
  });

  revalidatePath(BASE_PATH);
  return batch;
}

export async function unscheduleBatchRecord(batchRecordId: string) {
  const session = await requireAccess();

  const batch = await prisma.batchRecord.update({
    where: { id: batchRecordId },
    data: { machineId: null, scheduledDate: null, estimatedHours: null },
  });

  await logAudit(session, {
    action: "UNSCHEDULE_BATCH_RECORD",
    entityType: "BatchRecord",
    entityId: batch.id,
    summary: `Batch ${batch.batchNumber} (${batch.productName}) removed from the schedule`,
  });

  revalidatePath(BASE_PATH);
  return batch;
}
