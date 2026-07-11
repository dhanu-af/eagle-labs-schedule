"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/generated/prisma";

async function requireAdmin() {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");
  return session;
}

export async function createEmployee(formData: FormData) {
  const session = await requireAdmin();

  const name = String(formData.get("name") || "");
  const role = String(formData.get("role") || "EMPLOYEE") as Role;
  const teamId = String(formData.get("teamId") || "");
  const shift = String(formData.get("shift") || "Day");
  const photoUrl = String(formData.get("photoUrl") || "") || null;

  if (!name || !teamId) throw new Error("Name and team are required");

  const employee = await prisma.employee.create({
    data: { name, role, teamId, shift, photoUrl },
  });

  await logAudit(session, {
    action: "CREATE_EMPLOYEE",
    entityType: "Employee",
    entityId: employee.id,
    summary: `Created employee ${name} (${role}) in team ${teamId}`,
  });

  revalidatePath("/team");
}

export async function updateEmployee(
  id: string,
  data: {
    role?: Role;
    teamId?: string;
    shift?: string;
    active?: boolean;
    photoUrl?: string;
    hourlyRate?: number;
  }
) {
  const session = await requireAdmin();

  const target = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
  if (!target) throw new Error("Employee not found");

  if (target.user?.isPermanent) {
    throw new Error("This is a protected permanent account and cannot be modified");
  }

  await prisma.employee.update({ where: { id }, data });

  if (data.role) {
    await prisma.user.updateMany({ where: { employeeId: id }, data: { role: data.role } });
  }

  await logAudit(session, {
    action: "UPDATE_EMPLOYEE",
    entityType: "Employee",
    entityId: id,
    summary: `Updated employee ${target.name}: ${JSON.stringify(data)}`,
  });

  revalidatePath("/team");
}

export async function deleteEmployee(id: string) {
  const session = await requireAdmin();

  const target = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
  if (!target) throw new Error("Employee not found");
  if (target.user?.isPermanent) {
    throw new Error("This is a protected permanent account and cannot be deleted");
  }

  await prisma.dailyTask.updateMany({ where: { employeeId: id }, data: { employeeId: null } });
  await prisma.dailyTask.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await prisma.weeklyAssignment.deleteMany({ where: { employeeId: id } });
  await prisma.attendance.deleteMany({ where: { employeeId: id } });
  await prisma.leaveRequest.deleteMany({ where: { employeeId: id } });
  await prisma.leaveRequest.updateMany({ where: { approverId: id }, data: { approverId: null } });
  await prisma.payslip.deleteMany({ where: { employeeId: id } });
  await prisma.notification.deleteMany({ where: { employeeId: id } });
  await prisma.kpiRecord.deleteMany({ where: { employeeId: id } });
  if (target.user) {
    await prisma.user.delete({ where: { id: target.user.id } });
  }
  await prisma.employee.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_EMPLOYEE",
    entityType: "Employee",
    entityId: id,
    summary: `Deleted employee ${target.name}`,
  });

  revalidatePath("/team");
}

export async function createTeam(formData: FormData) {
  const session = await requireAdmin();

  const name = String(formData.get("name") || "");
  const description = String(formData.get("description") || "") || null;
  if (!name) throw new Error("Team name is required");

  const team = await prisma.team.create({ data: { name, description } });

  await logAudit(session, {
    action: "CREATE_TEAM",
    entityType: "Team",
    entityId: team.id,
    summary: `Created team ${name}`,
  });

  revalidatePath("/team");
}

export async function updateTeam(id: string, data: { name?: string; description?: string }) {
  const session = await requireAdmin();

  await prisma.team.update({ where: { id }, data });

  await logAudit(session, {
    action: "UPDATE_TEAM",
    entityType: "Team",
    entityId: id,
    summary: `Updated team ${id}: ${JSON.stringify(data)}`,
  });

  revalidatePath("/team");
}

export async function deleteTeam(id: string) {
  const session = await requireAdmin();

  const memberCount = await prisma.employee.count({ where: { teamId: id, active: true } });
  if (memberCount > 0) {
    throw new Error("Cannot delete a team with active employees. Reassign them first.");
  }

  const team = await prisma.team.findUnique({ where: { id } });
  await prisma.team.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_TEAM",
    entityType: "Team",
    entityId: id,
    summary: `Deleted team ${team?.name ?? id}`,
  });

  revalidatePath("/team");
}
