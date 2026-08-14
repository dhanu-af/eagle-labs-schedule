"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canSendTaskRequest } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyEmployee } from "@/lib/notify";
import type { Priority, TaskRequestStatus } from "@/generated/prisma";

async function requireLogin() {
  const session = await getSession();
  if (!session || !canSendTaskRequest(session.role)) throw new Error("Not authorized");
  return session;
}

export async function sendTaskRequest(
  toUserId: string,
  data: { title: string; message?: string | null; priority: Priority; dueDate?: string | null }
) {
  const session = await requireLogin();
  if (!data.title.trim()) throw new Error("Title is required");
  if (toUserId === session.userId) throw new Error("You can't send a task to yourself");

  const toUser = await prisma.user.findUnique({ where: { id: toUserId }, select: { fullName: true, disabled: true, employeeId: true } });
  if (!toUser || toUser.disabled) throw new Error("That person's account isn't available");

  const request = await prisma.taskRequest.create({
    data: {
      fromUserId: session.userId,
      toUserId,
      title: data.title.trim(),
      message: data.message?.trim() || null,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });

  // Bonus delivery via the notification bell -- only possible when the recipient's
  // login happens to be linked to an Employee record. The TaskRequest row above
  // (keyed on User, which every login always has) is what actually guarantees
  // delivery; this is purely an extra, never required for the feature to work.
  if (toUser.employeeId) {
    await notifyEmployee({
      employeeId: toUser.employeeId,
      title: `New task from ${session.fullName}`,
      message: data.title.trim(),
      type: "TASK_REQUEST",
      link: "/",
    });
  }

  await logAudit(session, {
    action: "SEND_TASK_REQUEST",
    entityType: "TaskRequest",
    entityId: request.id,
    summary: `${session.fullName} sent "${data.title.trim()}" to ${toUser.fullName}`,
  });

  revalidatePath("/", "layout");
  return request;
}

export async function listMyPendingTaskRequests() {
  const session = await getSession();
  if (!session) return [];

  return prisma.taskRequest.findMany({
    where: { toUserId: session.userId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    include: { fromUser: { select: { fullName: true } } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
}

const VALID_STATUSES: TaskRequestStatus[] = ["PENDING", "IN_PROGRESS", "DONE"];

export async function updateTaskRequestStatus(id: string, status: TaskRequestStatus) {
  const session = await requireLogin();
  if (!VALID_STATUSES.includes(status)) throw new Error("Unknown status");

  const before = await prisma.taskRequest.findUnique({ where: { id }, include: { fromUser: { select: { fullName: true, employeeId: true } } } });
  if (!before) throw new Error("Task request not found");
  if (before.toUserId !== session.userId) throw new Error("Only the person it was sent to can update this");

  const request = await prisma.taskRequest.update({ where: { id }, data: { status } });

  await logAudit(session, {
    action: "UPDATE_TASK_REQUEST_STATUS",
    entityType: "TaskRequest",
    entityId: request.id,
    summary: `"${request.title}" moved from ${before.status} to ${status}`,
  });

  if (status === "DONE" && before.status !== "DONE" && before.fromUser.employeeId) {
    await notifyEmployee({
      employeeId: before.fromUser.employeeId,
      title: "Task marked done",
      message: `${session.fullName} marked "${request.title}" done`,
      type: "TASK_REQUEST_DONE",
      link: "/",
    });
  }

  revalidatePath("/", "layout");
  return request;
}
