"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManageWeeklyMps } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { scaleIngredientQtyKg, checkIngredientAgainstStock, type MaterialLineStatus } from "@/lib/customer-order-defaults";
import { getItemStockSummary } from "@/lib/warehouse-ledger";
import { computePlannedQtyKg } from "@/lib/weekly-mps-defaults";
import type { Priority } from "@/generated/prisma";

const BASE_PATH = "/weekly-mps";

async function requireAccess() {
  const session = await getSession();
  if (!session || !canManageWeeklyMps(session.role)) throw new Error("Not authorized");
  return session;
}

export async function listWeeklyMpsEntries(weekEndingIso: string) {
  const weekEnding = new Date(weekEndingIso);
  return prisma.weeklyMpsEntry.findMany({
    where: { weekEnding },
    orderBy: [{ requiredDate: "asc" }, { createdAt: "asc" }],
    include: {
      product: { select: { name: true, sku: true } },
      machine: { select: { name: true, code: true } },
    },
  });
}

function rollUpStatuses(statuses: MaterialLineStatus[]): MaterialLineStatus {
  if (statuses.some((s) => s === "SHORT")) return "SHORT";
  if (statuses.some((s) => s === "UNMAPPED")) return "UNMAPPED";
  return "READY";
}

/** Live material-readiness check for one MPS entry -- reuses the exact same
 * scaling/stock helpers the Customer Order material check uses, against the
 * entry's linked Product/Formulation and computed planned quantity. Never
 * persisted; recomputed on demand from real, current warehouse stock. */
export async function computeMaterialReadiness(entryId: string): Promise<MaterialLineStatus | "NO_BOM"> {
  const entry = await prisma.weeklyMpsEntry.findUnique({
    where: { id: entryId },
    include: { product: { include: { formulation: { include: { ingredients: true } } } } },
  });
  if (!entry) throw new Error("Entry not found");

  const formulation = entry.product.formulation;
  if (!formulation) return "NO_BOM";
  if (formulation.ingredients.length === 0) return "READY";

  const plannedQtyKg = computePlannedQtyKg(entry.batchSizeKg, entry.plannedBatches);

  const statuses = await Promise.all(
    formulation.ingredients.map(async (ing): Promise<MaterialLineStatus> => {
      if (!ing.warehouseItemId) return "UNMAPPED";
      const requiredQtyKg = scaleIngredientQtyKg(ing.baseQty, formulation, { quantity: plannedQtyKg, unit: "kg" });
      const stock = await getItemStockSummary(ing.warehouseItemId);
      return checkIngredientAgainstStock(requiredQtyKg, stock).status;
    })
  );

  return rollUpStatuses(statuses);
}

export type WeeklyMpsEntryInput = {
  weekEnding: string;
  machineId?: string | null;
  productId: string;
  batchSizeKg: number;
  plannedBatches: number;
  requiredDate?: string | null;
  priority: Priority;
  notes?: string | null;
};

export async function createWeeklyMpsEntry(data: WeeklyMpsEntryInput) {
  const session = await requireAccess();
  if (!data.productId) throw new Error("Product is required");
  if (!data.batchSizeKg || data.batchSizeKg <= 0) throw new Error("Batch size must be greater than 0");
  if (!data.plannedBatches || data.plannedBatches <= 0) throw new Error("Planned batches must be greater than 0");

  const product = await prisma.product.findUnique({ where: { id: data.productId }, select: { name: true } });
  if (!product) throw new Error("Product not found");

  const entry = await prisma.weeklyMpsEntry.create({
    data: {
      weekEnding: new Date(data.weekEnding),
      machineId: data.machineId || null,
      productId: data.productId,
      batchSizeKg: data.batchSizeKg,
      plannedBatches: data.plannedBatches,
      requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
      priority: data.priority,
      notes: data.notes?.trim() || null,
      createdById: session.userId,
      createdByName: session.fullName,
    },
  });

  await logAudit(session, {
    action: "CREATE_WEEKLY_MPS_ENTRY",
    entityType: "WeeklyMpsEntry",
    entityId: entry.id,
    summary: `MPS entry added for ${product.name}, week ending ${entry.weekEnding.toDateString()} (${data.plannedBatches} batch${data.plannedBatches === 1 ? "" : "es"} x ${data.batchSizeKg}kg)`,
  });

  revalidatePath(BASE_PATH);
  return entry;
}

export async function updateWeeklyMpsEntry(id: string, data: WeeklyMpsEntryInput) {
  const session = await requireAccess();
  if (!data.productId) throw new Error("Product is required");
  if (!data.batchSizeKg || data.batchSizeKg <= 0) throw new Error("Batch size must be greater than 0");
  if (!data.plannedBatches || data.plannedBatches <= 0) throw new Error("Planned batches must be greater than 0");

  const before = await prisma.weeklyMpsEntry.findUnique({ where: { id }, select: { frozen: true } });
  if (!before) throw new Error("Entry not found");
  if (before.frozen) throw new Error("This entry is frozen -- unfreeze it before editing the plan");

  const entry = await prisma.weeklyMpsEntry.update({
    where: { id },
    data: {
      weekEnding: new Date(data.weekEnding),
      machineId: data.machineId || null,
      productId: data.productId,
      batchSizeKg: data.batchSizeKg,
      plannedBatches: data.plannedBatches,
      requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
      priority: data.priority,
      notes: data.notes?.trim() || null,
    },
  });

  await logAudit(session, {
    action: "UPDATE_WEEKLY_MPS_ENTRY",
    entityType: "WeeklyMpsEntry",
    entityId: entry.id,
    summary: `MPS entry updated (${data.plannedBatches} batch${data.plannedBatches === 1 ? "" : "es"} x ${data.batchSizeKg}kg)`,
  });

  revalidatePath(BASE_PATH);
  return entry;
}

export async function updateReadinessFlags(id: string, flags: { frozen?: boolean; qcReady?: boolean; maintenanceReady?: boolean }) {
  const session = await requireAccess();

  const before = await prisma.weeklyMpsEntry.findUnique({ where: { id }, select: { frozen: true, qcReady: true, maintenanceReady: true } });
  if (!before) throw new Error("Entry not found");

  const entry = await prisma.weeklyMpsEntry.update({ where: { id }, data: flags });

  const changes = Object.entries(flags)
    .filter(([k, v]) => v !== before[k as keyof typeof before])
    .map(([k, v]) => `${k} -> ${v}`)
    .join(", ");

  await logAudit(session, {
    action: "UPDATE_WEEKLY_MPS_READINESS",
    entityType: "WeeklyMpsEntry",
    entityId: entry.id,
    summary: `MPS entry readiness changed: ${changes || "no change"}`,
  });

  revalidatePath(BASE_PATH);
  return entry;
}

export async function deleteWeeklyMpsEntry(id: string) {
  const session = await requireAccess();

  const entry = await prisma.weeklyMpsEntry.findUnique({ where: { id }, select: { frozen: true } });
  if (!entry) throw new Error("Entry not found");
  if (entry.frozen) throw new Error("This entry is frozen -- unfreeze it before deleting");

  await prisma.weeklyMpsEntry.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_WEEKLY_MPS_ENTRY",
    entityType: "WeeklyMpsEntry",
    entityId: id,
    summary: "MPS entry deleted",
  });

  revalidatePath(BASE_PATH);
}
