"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyAllEmployees, notifyEmployee } from "@/lib/notify";
import type { AttendanceStatus } from "@/generated/prisma";

export async function markAttendance(
  employeeId: string,
  dateStr: string,
  status: AttendanceStatus,
  hoursWorked: number,
  overtime: number
) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  const date = new Date(`${dateStr}T00:00:00`);

  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { status, hoursWorked, overtime },
    create: { employeeId, date, status, hoursWorked, overtime },
  });

  await logAudit(session, {
    action: "MARK_ATTENDANCE",
    entityType: "Attendance",
    entityId: employeeId,
    summary: `Marked ${status} for employee ${employeeId} on ${dateStr} (${hoursWorked}h, OT ${overtime}h)`,
  });

  revalidatePath("/attendance");
  revalidatePath("/");
}

export async function requestLeave(formData: FormData) {
  const session = await getSession();
  if (!session?.employeeId) throw new Error("Not authorized");

  const startDate = new Date(String(formData.get("startDate")));
  const endDate = new Date(String(formData.get("endDate")));
  const type = String(formData.get("type") || "Annual");
  const reason = String(formData.get("reason") || "") || null;

  const leave = await prisma.leaveRequest.create({
    data: { employeeId: session.employeeId, startDate, endDate, type, reason },
  });

  await logAudit(session, {
    action: "REQUEST_LEAVE",
    entityType: "LeaveRequest",
    entityId: leave.id,
    summary: `${session.fullName} requested ${type} leave`,
  });

  await notifyAllEmployees({
    title: "New leave request",
    message: `${session.fullName} requested ${type} leave from ${startDate.toDateString()} to ${endDate.toDateString()}`,
    type: "LEAVE_REQUESTED",
    link: "/attendance",
  });

  revalidatePath("/attendance");
}

export async function updateLeaveStatus(id: string, status: "APPROVED" | "REJECTED") {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  const leave = await prisma.leaveRequest.update({
    where: { id },
    data: { status, approverId: session.employeeId ?? undefined },
  });

  if (status === "APPROVED") {
    const days =
      Math.round((leave.endDate.getTime() - leave.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    await prisma.employee.update({
      where: { id: leave.employeeId },
      data: { leaveBalance: { decrement: Math.max(0, days) } },
    });
  }

  await logAudit(session, {
    action: "UPDATE_LEAVE_STATUS",
    entityType: "LeaveRequest",
    entityId: id,
    summary: `Leave request ${id} set to ${status}`,
  });

  await notifyEmployee({
    employeeId: leave.employeeId,
    title: `Leave ${status === "APPROVED" ? "approved" : "rejected"}`,
    message: `Your ${leave.type} leave request has been ${status.toLowerCase()}.`,
    type: "LEAVE_STATUS",
    link: "/attendance",
  });

  revalidatePath("/attendance");
}
