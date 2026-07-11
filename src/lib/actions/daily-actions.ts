"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit, canUpdateDailyProgress } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyManagers } from "@/lib/notify";
import type { Priority, TaskStatus } from "@/generated/prisma";

async function requireManager() {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");
  return session;
}

async function requireProgressAccess() {
  const session = await getSession();
  if (!session || !canUpdateDailyProgress(session.role)) throw new Error("Not authorized");
  return session;
}

export async function createDailyTask(formData: FormData) {
  const session = await requireManager();

  const date = new Date(String(formData.get("date")));
  const teamId = String(formData.get("teamId"));
  const employeeId = String(formData.get("employeeId") || "") || null;
  const product = String(formData.get("product") || "");
  const batchNo = String(formData.get("batchNo") || "") || null;
  const process = String(formData.get("process") || "");
  const targetQtyRaw = String(formData.get("targetQty") || "");
  const targetQty = targetQtyRaw ? Number(targetQtyRaw) : null;
  const targetUnit = String(formData.get("targetUnit") || "kg");
  const plannedStart = String(formData.get("plannedStart") || "") || null;
  const plannedFinish = String(formData.get("plannedFinish") || "") || null;
  const priority = String(formData.get("priority") || "MEDIUM") as Priority;
  const notes = String(formData.get("notes") || "") || null;

  if (!product || !process || !teamId) {
    throw new Error("Product, process and team are required");
  }

  const task = await prisma.dailyTask.create({
    data: {
      date,
      teamId,
      employeeId,
      product,
      batchNo,
      process,
      targetQty,
      targetUnit,
      plannedStart,
      plannedFinish,
      priority,
      notes,
    },
  });

  await logAudit(session, {
    action: "CREATE_TASK",
    entityType: "DailyTask",
    entityId: task.id,
    summary: `Created task ${product} · ${process} for team ${teamId}`,
  });

  revalidatePath("/daily");
  revalidatePath("/");
}

export async function updateDailyTask(id: string, formData: FormData) {
  const session = await requireManager();

  const employeeId = String(formData.get("employeeId") || "") || null;
  const product = String(formData.get("product") || "");
  const batchNo = String(formData.get("batchNo") || "") || null;
  const process = String(formData.get("process") || "");
  const targetQtyRaw = String(formData.get("targetQty") || "");
  const targetQty = targetQtyRaw ? Number(targetQtyRaw) : null;
  const targetUnit = String(formData.get("targetUnit") || "kg");
  const plannedStart = String(formData.get("plannedStart") || "") || null;
  const plannedFinish = String(formData.get("plannedFinish") || "") || null;
  const priority = String(formData.get("priority") || "MEDIUM") as Priority;
  const notes = String(formData.get("notes") || "") || null;

  if (!product || !process) throw new Error("Product and process are required");

  await prisma.dailyTask.update({
    where: { id },
    data: {
      employeeId,
      product,
      batchNo,
      process,
      targetQty,
      targetUnit,
      plannedStart,
      plannedFinish,
      priority,
      notes,
    },
  });

  await logAudit(session, {
    action: "UPDATE_TASK",
    entityType: "DailyTask",
    entityId: id,
    summary: `Updated task ${product} · ${process}`,
  });

  revalidatePath("/daily");
  revalidatePath("/");
}

export async function deleteDailyTask(id: string) {
  const session = await requireManager();

  const task = await prisma.dailyTask.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_TASK",
    entityType: "DailyTask",
    entityId: id,
    summary: `Deleted task ${task.product} · ${task.process}`,
  });

  revalidatePath("/daily");
  revalidatePath("/");
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  delayReason?: string,
  actualQty?: number
) {
  const session = await requireProgressAccess();

  const task = await prisma.dailyTask.update({
    where: { id: taskId },
    data: {
      status,
      delayReason: status === "DELAYED" ? delayReason ?? null : null,
      actualQty: actualQty ?? undefined,
      updatedById: session.employeeId ?? undefined,
    },
  });

  await logAudit(session, {
    action: "UPDATE_TASK_STATUS",
    entityType: "DailyTask",
    entityId: taskId,
    summary: `Set ${task.product} · ${task.process} to ${status}${delayReason ? ` (${delayReason})` : ""}`,
  });

  if (status === "DELAYED") {
    await notifyManagers({
      title: "Task delayed",
      message: `${task.product} · ${task.process} was marked delayed${delayReason ? `: ${delayReason}` : ""}`,
      type: "TASK_DELAYED",
      link: "/daily",
    });
  }

  revalidatePath("/daily");
  revalidatePath("/");
}

export async function duplicatePreviousDay(dateStr: string) {
  const session = await requireManager();

  const date = new Date(dateStr);
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  prevDay.setHours(0, 0, 0, 0);
  const prevDayEnd = new Date(prevDay);
  prevDayEnd.setDate(prevDayEnd.getDate() + 1);

  const prevTasks = await prisma.dailyTask.findMany({
    where: { date: { gte: prevDay, lt: prevDayEnd } },
  });

  if (prevTasks.length === 0) return;

  await prisma.dailyTask.createMany({
    data: prevTasks.map((t) => ({
      date,
      teamId: t.teamId,
      employeeId: t.employeeId,
      product: t.product,
      batchNo: t.batchNo,
      process: t.process,
      targetQty: t.targetQty,
      targetUnit: t.targetUnit,
      plannedStart: t.plannedStart,
      plannedFinish: t.plannedFinish,
      priority: t.priority,
      notes: t.notes,
    })),
  });

  await logAudit(session, {
    action: "DUPLICATE_DAY",
    entityType: "DailyTask",
    summary: `Duplicated ${prevTasks.length} task(s) from previous day into ${dateStr}`,
  });

  revalidatePath("/daily");
  revalidatePath("/");
}
