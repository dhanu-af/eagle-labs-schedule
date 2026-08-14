"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManageActionLog } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { ActionSourceSection, ActionLogStatus, EscalationLevel, Priority } from "@/generated/prisma";

const BASE_PATH = "/action-log";

async function requireAccess() {
  const session = await getSession();
  if (!session || !canManageActionLog(session.role)) throw new Error("Not authorized");
  return session;
}

async function nextActionNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.siteActionLog.count({ where: { actionNumber: { startsWith: `ACT-${year}-` } } });
  return `ACT-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function listActionLog() {
  return prisma.siteActionLog.findMany({ orderBy: [{ status: "asc" }, { dueDate: "asc" }, { dateRaised: "desc" }] });
}

export async function createActionLogEntry(data: {
  sourceSection: ActionSourceSection;
  issue: string;
  businessImpact?: string | null;
  priority: Priority;
  owner: string;
  dueDate?: string | null;
  escalationLevel: EscalationLevel;
}) {
  const session = await requireAccess();
  if (!data.issue.trim()) throw new Error("Issue / exception description is required");
  if (!data.owner.trim()) throw new Error("Owner is required");

  const actionNumber = await nextActionNumber();

  const entry = await prisma.siteActionLog.create({
    data: {
      actionNumber,
      sourceSection: data.sourceSection,
      issue: data.issue.trim(),
      businessImpact: data.businessImpact?.trim() || null,
      priority: data.priority,
      owner: data.owner.trim(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      escalationLevel: data.escalationLevel,
      createdById: session.userId,
      createdByName: session.fullName,
    },
  });

  await logAudit(session, {
    action: "CREATE_ACTION_LOG_ENTRY",
    entityType: "SiteActionLog",
    entityId: entry.id,
    summary: `Action ${entry.actionNumber} raised (${data.priority}, owner ${entry.owner}): ${entry.issue}`,
  });

  revalidatePath(BASE_PATH);
  return entry;
}

export async function updateActionLogEntry(
  id: string,
  data: {
    sourceSection: ActionSourceSection;
    issue: string;
    businessImpact?: string | null;
    priority: Priority;
    owner: string;
    dueDate?: string | null;
    escalationLevel: EscalationLevel;
  }
) {
  const session = await requireAccess();
  if (!data.issue.trim()) throw new Error("Issue / exception description is required");
  if (!data.owner.trim()) throw new Error("Owner is required");

  const entry = await prisma.siteActionLog.update({
    where: { id },
    data: {
      sourceSection: data.sourceSection,
      issue: data.issue.trim(),
      businessImpact: data.businessImpact?.trim() || null,
      priority: data.priority,
      owner: data.owner.trim(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      escalationLevel: data.escalationLevel,
    },
  });

  await logAudit(session, {
    action: "UPDATE_ACTION_LOG_ENTRY",
    entityType: "SiteActionLog",
    entityId: entry.id,
    summary: `Action ${entry.actionNumber} updated`,
  });

  revalidatePath(BASE_PATH);
  return entry;
}

const VALID_STATUSES: ActionLogStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export async function updateActionLogStatus(id: string, status: ActionLogStatus, resolution?: string | null) {
  const session = await requireAccess();
  if (!VALID_STATUSES.includes(status)) throw new Error("Unknown status");

  const before = await prisma.siteActionLog.findUnique({ where: { id }, select: { actionNumber: true, status: true } });
  if (!before) throw new Error("Action not found");

  const closingNow = (status === "RESOLVED" || status === "CLOSED") && before.status !== "RESOLVED" && before.status !== "CLOSED";

  const entry = await prisma.siteActionLog.update({
    where: { id },
    data: {
      status,
      resolution: resolution !== undefined ? resolution?.trim() || null : undefined,
      closedDate: closingNow ? new Date() : status === "OPEN" || status === "IN_PROGRESS" ? null : undefined,
    },
  });

  await logAudit(session, {
    action: "UPDATE_ACTION_LOG_STATUS",
    entityType: "SiteActionLog",
    entityId: entry.id,
    summary: `Action ${entry.actionNumber} moved from ${before.status} to ${status}`,
  });

  revalidatePath(BASE_PATH);
  return entry;
}

export async function deleteActionLogEntry(id: string) {
  const session = await requireAccess();

  const entry = await prisma.siteActionLog.findUnique({ where: { id }, select: { actionNumber: true } });
  if (!entry) throw new Error("Action not found");

  await prisma.siteActionLog.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_ACTION_LOG_ENTRY",
    entityType: "SiteActionLog",
    entityId: id,
    summary: `Action ${entry.actionNumber} deleted`,
  });

  revalidatePath(BASE_PATH);
}
