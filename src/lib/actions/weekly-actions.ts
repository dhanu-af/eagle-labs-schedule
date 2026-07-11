"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function requireManager() {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");
  return session;
}

export async function createWeeklyAssignment(formData: FormData) {
  const session = await requireManager();

  const weekStart = new Date(String(formData.get("weekStart")));
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const teamId = String(formData.get("teamId"));
  const employeeId = String(formData.get("employeeId"));
  const task = String(formData.get("task") || "");
  const hours = Number(formData.get("hours") || 8);

  if (!teamId || !employeeId || !task) {
    throw new Error("Team, employee and task are required");
  }

  const assignment = await prisma.weeklyAssignment.create({
    data: { weekStart, dayOfWeek, teamId, employeeId, task, hours },
  });

  await logAudit(session, {
    action: "CREATE_WEEKLY_ASSIGNMENT",
    entityType: "WeeklyAssignment",
    entityId: assignment.id,
    summary: `Assigned ${task} (${hours}h) on day ${dayOfWeek}`,
  });

  revalidatePath("/weekly");
}

export async function updateWeeklyAssignment(id: string, task: string, hours: number) {
  const session = await requireManager();

  await prisma.weeklyAssignment.update({ where: { id }, data: { task, hours } });

  await logAudit(session, {
    action: "UPDATE_WEEKLY_ASSIGNMENT",
    entityType: "WeeklyAssignment",
    entityId: id,
    summary: `Updated assignment to ${task} (${hours}h)`,
  });

  revalidatePath("/weekly");
}

export async function moveWeeklyAssignment(id: string, dayOfWeek: number) {
  const session = await requireManager();

  await prisma.weeklyAssignment.update({
    where: { id },
    data: { dayOfWeek },
  });

  await logAudit(session, {
    action: "MOVE_WEEKLY_ASSIGNMENT",
    entityType: "WeeklyAssignment",
    entityId: id,
    summary: `Moved assignment to day ${dayOfWeek}`,
  });

  revalidatePath("/weekly");
}

export async function deleteWeeklyAssignment(id: string) {
  const session = await requireManager();

  await prisma.weeklyAssignment.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_WEEKLY_ASSIGNMENT",
    entityType: "WeeklyAssignment",
    entityId: id,
    summary: `Deleted weekly assignment ${id}`,
  });

  revalidatePath("/weekly");
}

export async function copyPreviousWeek(weekStart: string, teamId: string) {
  const session = await requireManager();

  const start = new Date(weekStart);
  const prevWeekStart = new Date(start);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const prevAssignments = await prisma.weeklyAssignment.findMany({
    where: { weekStart: prevWeekStart, teamId },
  });

  if (prevAssignments.length === 0) return;

  await prisma.weeklyAssignment.createMany({
    data: prevAssignments.map((a) => ({
      weekStart: start,
      dayOfWeek: a.dayOfWeek,
      teamId: a.teamId,
      employeeId: a.employeeId,
      task: a.task,
      hours: a.hours,
    })),
  });

  await logAudit(session, {
    action: "COPY_WEEK",
    entityType: "WeeklyAssignment",
    summary: `Copied ${prevAssignments.length} assignment(s) from previous week into week of ${weekStart}`,
  });

  revalidatePath("/weekly");
}
