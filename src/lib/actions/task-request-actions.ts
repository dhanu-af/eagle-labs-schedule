"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canSendTaskRequest } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyEmployee } from "@/lib/notify";
import type { Priority, TaskRequestStatus } from "@/generated/prisma";

async function requireEmployeeSession() {
  const session = await getSession();
  if (!session || !canSendTaskRequest(session.role)) throw new Error("Not authorized");
  if (!session.employeeId) throw new Error("Your login isn't linked to an Employee record, so you can't send or receive task requests.");
  return session as typeof session & { employeeId: string };
}

export async function sendTaskRequest(
  toEmployeeId: string,
  data: { title: string; message?: string | null; priority: Priority; dueDate?: string | null }
) {
  const session = await requireEmployeeSession();
  if (!data.title.trim()) throw new Error("Title is required");
  if (toEmployeeId === session.employeeId) throw new Error("You can't send a task to yourself");

  const toEmployee = await prisma.employee.findUnique({ where: { id: toEmployeeId }, select: { name: true, active: true } });
  if (!toEmployee || !toEmployee.active) throw new Error("That employee isn't available");

  const request = await prisma.employeeTaskRequest.create({
    data: {
      fromEmployeeId: session.employeeId,
      toEmployeeId,
      title: data.title.trim(),
      message: data.message?.trim() || null,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });

  await notifyEmployee({
    employeeId: toEmployeeId,
    title: `New task from ${session.fullName}`,
    message: data.title.trim(),
    type: "TASK_REQUEST",
    link: "/",
  });

  await logAudit(session, {
    action: "SEND_TASK_REQUEST",
    entityType: "EmployeeTaskRequest",
    entityId: request.id,
    summary: `${session.fullName} sent "${data.title.trim()}" to ${toEmployee.name}`,
  });

  revalidatePath("/");
  return request;
}

export async function listMyPendingTaskRequests() {
  const session = await getSession();
  if (!session?.employeeId) return [];

  return prisma.employeeTaskRequest.findMany({
    where: { toEmployeeId: session.employeeId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    include: { fromEmployee: { select: { name: true } } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
}

const VALID_STATUSES: TaskRequestStatus[] = ["PENDING", "IN_PROGRESS", "DONE"];

export async function updateTaskRequestStatus(id: string, status: TaskRequestStatus) {
  const session = await requireEmployeeSession();
  if (!VALID_STATUSES.includes(status)) throw new Error("Unknown status");

  const before = await prisma.employeeTaskRequest.findUnique({ where: { id } });
  if (!before) throw new Error("Task request not found");
  if (before.toEmployeeId !== session.employeeId) throw new Error("Only the person it was sent to can update this");

  const request = await prisma.employeeTaskRequest.update({ where: { id }, data: { status } });

  await logAudit(session, {
    action: "UPDATE_TASK_REQUEST_STATUS",
    entityType: "EmployeeTaskRequest",
    entityId: request.id,
    summary: `"${request.title}" moved from ${before.status} to ${status}`,
  });

  if (status === "DONE" && before.status !== "DONE") {
    await notifyEmployee({
      employeeId: before.fromEmployeeId,
      title: "Task marked done",
      message: `${session.fullName} marked "${request.title}" done`,
      type: "TASK_REQUEST_DONE",
      link: "/",
    });
  }

  revalidatePath("/");
  return request;
}
