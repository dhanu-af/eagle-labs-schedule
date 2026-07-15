"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit, canEditKpiProduction } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function requireManager() {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");
  return session;
}

async function requireProductionEditor() {
  const session = await getSession();
  if (!session || !canEditKpiProduction(session.role)) throw new Error("Not authorized");
  return session;
}

export async function createKpi(formData: FormData) {
  const session = await requireManager();

  const teamId = String(formData.get("teamId") || "");
  const product = String(formData.get("product") || "").trim() || null;
  const name = String(formData.get("name") || "");
  const unit = String(formData.get("unit") || "kg");
  const target = Number(formData.get("target") || 0);

  if (!teamId || !name || !target) throw new Error("Team, name and target are required");

  const kpi = await prisma.kpi.create({ data: { teamId, product, name, unit, target } });

  await logAudit(session, {
    action: "CREATE_KPI",
    entityType: "Kpi",
    entityId: kpi.id,
    summary: `Created KPI ${name} (target ${target} ${unit}) for team ${teamId}`,
  });

  revalidatePath("/kpi");
}

export async function updateKpi(id: string, formData: FormData) {
  const session = await requireManager();

  const product = String(formData.get("product") || "").trim() || null;
  const name = String(formData.get("name") || "");
  const unit = String(formData.get("unit") || "kg");
  const target = Number(formData.get("target") || 0);

  if (!name || !target) throw new Error("Name and target are required");

  await prisma.kpi.update({ where: { id }, data: { product, name, unit, target } });

  await logAudit(session, {
    action: "UPDATE_KPI",
    entityType: "Kpi",
    entityId: id,
    summary: `Updated KPI ${id}: ${name}, target ${target} ${unit}`,
  });

  revalidatePath("/kpi");
}

export async function deleteKpi(id: string) {
  const session = await requireManager();

  await prisma.kpiRecord.deleteMany({ where: { kpiId: id } });
  await prisma.kpiDailyTarget.deleteMany({ where: { kpiId: id } });
  await prisma.kpi.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_KPI",
    entityType: "Kpi",
    entityId: id,
    summary: `Deleted KPI ${id}`,
  });

  revalidatePath("/kpi");
}

export async function setDailyTarget(kpiId: string, dateStr: string, target: number) {
  const session = await requireManager();

  const date = new Date(`${dateStr}T00:00:00`);

  await prisma.kpiDailyTarget.upsert({
    where: { kpiId_date: { kpiId, date } },
    update: { target },
    create: { kpiId, date, target },
  });

  await logAudit(session, {
    action: "SET_KPI_DAILY_TARGET",
    entityType: "Kpi",
    entityId: kpiId,
    summary: `Set target for ${dateStr} to ${target} on KPI ${kpiId}`,
  });

  revalidatePath("/kpi");
}

export async function setKpiDailyProduction(
  kpiId: string,
  dateStr: string,
  data: {
    batchWeightKg: number | null;
    fillWeightMg: number | null;
    capsulesPerBottle: number | null;
    productionTimeHours: number | null;
  }
) {
  const session = await requireProductionEditor();

  const date = new Date(`${dateStr}T00:00:00`);

  await prisma.kpiDailyProduction.upsert({
    where: { kpiId_date: { kpiId, date } },
    update: { ...data, updatedBy: session.fullName },
    create: { kpiId, date, ...data, updatedBy: session.fullName },
  });

  await logAudit(session, {
    action: "SET_KPI_DAILY_PRODUCTION",
    entityType: "Kpi",
    entityId: kpiId,
    summary: `Set production details for ${dateStr} on KPI ${kpiId}`,
  });

  revalidatePath("/kpi");
}
