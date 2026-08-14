"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canSendTaskRequest } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyEmployee } from "@/lib/notify";
import type { Priority, TaskRequestStatus, Role } from "@/generated/prisma";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  OPERATIONS: "Operations",
  TEAM_LEAD: "Team Lead",
  QA: "QA",
  EMPLOYEE: "Employee",
  OTHERS: "Others",
  EXTRA: "Extra",
};

/** Every active login except the caller, for the "Send a Task" recipient picker --
 * shared by the global header button (layout.tsx) and any page-specific "send for
 * review" action (e.g. Environmental Checks) so both stay in sync. */
export async function listTaskRequestRecipients() {
  const session = await getSession();
  if (!session) return [];

  const users = await prisma.user.findMany({
    where: { disabled: false, id: { not: session.userId } },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, role: true },
  });
  return users.map((u) => ({ id: u.id, fullName: u.fullName, roleLabel: ROLE_LABELS[u.role] ?? u.role }));
}

async function requireLogin() {
  const session = await getSession();
  if (!session || !canSendTaskRequest(session.role)) throw new Error("Not authorized");
  return session;
}

export async function sendTaskRequest(
  toUserId: string,
  data: { title: string; message?: string | null; priority: Priority; dueDate?: string | null; link?: string | null }
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
      link: data.link || null,
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

export type TaskRequestHistoryRow = {
  id: string;
  title: string;
  message: string | null;
  link: string | null;
  priority: Priority;
  status: TaskRequestStatus;
  dueDate: Date | null;
  createdAt: Date;
  direction: "SENT" | "RECEIVED";
  counterpartyName: string;
};

/** Every task request this person has ever sent or received, in both directions
 * and every status (including DONE) -- unlike listMyPendingTaskRequests(), which
 * deliberately only shows PENDING/IN_PROGRESS for the urgent banner and drops off
 * a request the moment it's marked done. This is the "what did I send/get, and
 * what happened to it" view. */
export async function listMyTaskRequestHistory(): Promise<TaskRequestHistoryRow[]> {
  const session = await getSession();
  if (!session) return [];

  const requests = await prisma.taskRequest.findMany({
    where: { OR: [{ fromUserId: session.userId }, { toUserId: session.userId }] },
    include: { fromUser: { select: { fullName: true } }, toUser: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return requests.map((r) => {
    const direction = r.fromUserId === session.userId ? ("SENT" as const) : ("RECEIVED" as const);
    return {
      id: r.id,
      title: r.title,
      message: r.message,
      link: r.link,
      priority: r.priority,
      status: r.status,
      dueDate: r.dueDate,
      createdAt: r.createdAt,
      direction,
      counterpartyName: direction === "SENT" ? r.toUser.fullName : r.fromUser.fullName,
    };
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
