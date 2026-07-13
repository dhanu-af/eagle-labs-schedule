"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  canActAsSupervisor,
  canActAsQa,
  canActAsOperator,
  canUnlockChecks,
  canApproveWorkLog,
  canEdit,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyAllEmployees } from "@/lib/notify";
import type { EnvArea, PostOpItem, CleaningType, WorkLogRoom, WorkLogActivity } from "@/generated/prisma";

const CHECKS_PATH = "/checks";

function requireSession() {
  return getSession().then((session) => {
    if (!session) throw new Error("Not authorized");
    return session;
  });
}

// ───────────────────────── Supervisor Pre-Op Checks ─────────────────────────

export async function createSupervisorPreOpCheck(data: {
  date: string;
  room: string;
  roomCleanliness: boolean;
  equipmentReadiness: boolean;
  safetyPpeVerified: boolean;
  calibrationStatus?: string;
  comments?: string;
  signature: string;
}) {
  const session = await requireSession();
  if (!canActAsSupervisor(session.role)) throw new Error("Not authorized");
  if (!data.signature.trim()) throw new Error("Signature is required");

  const check = await prisma.supervisorPreOpCheck.create({
    data: {
      date: new Date(`${data.date}T00:00:00Z`),
      room: data.room,
      roomCleanliness: data.roomCleanliness,
      equipmentReadiness: data.equipmentReadiness,
      safetyPpeVerified: data.safetyPpeVerified,
      calibrationStatus: data.calibrationStatus || null,
      comments: data.comments || null,
      signature: data.signature.trim(),
      submittedById: session.userId,
      submittedByName: session.fullName,
      submittedByRole: session.role,
      status: "COMPLETED",
    },
  });

  await logAudit(session, {
    action: "CREATE_SUPERVISOR_PREOP_CHECK",
    entityType: "SupervisorPreOpCheck",
    entityId: check.id,
    summary: `${session.fullName} submitted Supervisor Pre-Op Check for ${data.room}`,
  });

  revalidatePath(CHECKS_PATH);
}

// ───────────────────────────── QA Pre-Op Checks ──────────────────────────────

export async function createQaPreOpCheck(data: {
  date: string;
  room: string;
  qaRoomInspection: boolean;
  equipmentVerification: boolean;
  gmpCompliance: boolean;
  environmentalCondition: boolean;
  comments?: string;
  signature: string;
}) {
  const session = await requireSession();
  if (!canActAsQa(session.role)) throw new Error("Not authorized");
  if (!data.signature.trim()) throw new Error("Signature is required");

  const check = await prisma.qaPreOpCheck.create({
    data: {
      date: new Date(`${data.date}T00:00:00Z`),
      room: data.room,
      qaRoomInspection: data.qaRoomInspection,
      equipmentVerification: data.equipmentVerification,
      gmpCompliance: data.gmpCompliance,
      environmentalCondition: data.environmentalCondition,
      comments: data.comments || null,
      signature: data.signature.trim(),
      submittedById: session.userId,
      submittedByName: session.fullName,
      submittedByRole: session.role,
      status: "COMPLETED",
    },
  });

  await logAudit(session, {
    action: "CREATE_QA_PREOP_CHECK",
    entityType: "QaPreOpCheck",
    entityId: check.id,
    summary: `${session.fullName} submitted QA Pre-Op Check for ${data.room}`,
  });

  revalidatePath(CHECKS_PATH);
}

// ────────────────────── RH & Temperature (Environmental) ───────────────────────

export async function createEnvironmentalCheck(data: {
  date: string;
  area: EnvArea;
  temperature: number;
  humidity: number;
  remarks?: string;
  signature: string;
}) {
  const session = await requireSession();
  if (!canActAsOperator(session.role)) throw new Error("Not authorized");
  if (!data.signature.trim()) throw new Error("Signature is required");

  const limit = await prisma.environmentalLimit.findUnique({ where: { area: data.area } });
  const passFail = limit
    ? data.temperature >= limit.minTemp &&
      data.temperature <= limit.maxTemp &&
      data.humidity >= limit.minRH &&
      data.humidity <= limit.maxRH
    : true;

  const check = await prisma.environmentalCheck.create({
    data: {
      date: new Date(`${data.date}T00:00:00Z`),
      area: data.area,
      temperature: data.temperature,
      humidity: data.humidity,
      passFail,
      remarks: data.remarks || null,
      signature: data.signature.trim(),
      submittedById: session.userId,
      submittedByName: session.fullName,
      submittedByRole: session.role,
      status: "PENDING",
    },
  });

  await logAudit(session, {
    action: "CREATE_ENVIRONMENTAL_CHECK",
    entityType: "EnvironmentalCheck",
    entityId: check.id,
    summary: `${session.fullName} recorded ${data.area} reading: ${data.temperature}°C / ${data.humidity}% RH (${passFail ? "Pass" : "OOS"})`,
  });

  if (!passFail) {
    // OOS alert: notify all employees via the existing announcement/notification pipeline.
    await notifyAllEmployees({
      title: "Out-of-Specification environmental reading",
      message: `${data.area.replace("_", " ")}: ${data.temperature}°C / ${data.humidity}% RH is out of spec (recorded by ${session.fullName}).`,
      type: "ENV_OOS",
      link: CHECKS_PATH,
    });
  }

  revalidatePath(CHECKS_PATH);
  return { passFail };
}

export async function approveEnvironmentalCheck(id: string, as: "SUPERVISOR" | "QA") {
  const session = await requireSession();
  if (as === "SUPERVISOR" && !canActAsSupervisor(session.role)) throw new Error("Not authorized");
  if (as === "QA" && !canActAsQa(session.role)) throw new Error("Not authorized");

  const existing = await prisma.environmentalCheck.findUnique({ where: { id } });
  if (!existing) throw new Error("Record not found");
  if (existing.locked) throw new Error("This record is locked and cannot be modified");

  const data =
    as === "SUPERVISOR"
      ? {
          supervisorApprovedById: session.userId,
          supervisorApprovedByName: session.fullName,
          supervisorApprovedAt: new Date(),
        }
      : {
          qaApprovedById: session.userId,
          qaApprovedByName: session.fullName,
          qaApprovedAt: new Date(),
        };

  const bothApproved =
    (as === "SUPERVISOR" ? true : !!existing.supervisorApprovedAt) &&
    (as === "QA" ? true : !!existing.qaApprovedAt);

  await prisma.environmentalCheck.update({
    where: { id },
    data: {
      ...data,
      status: bothApproved ? "APPROVED" : "IN_PROGRESS",
      locked: bothApproved,
    },
  });

  await logAudit(session, {
    action: as === "SUPERVISOR" ? "SUPERVISOR_APPROVE_ENV_CHECK" : "QA_APPROVE_ENV_CHECK",
    entityType: "EnvironmentalCheck",
    entityId: id,
    summary: `${session.fullName} approved environmental check as ${as}`,
  });

  revalidatePath(CHECKS_PATH);
}

export async function updateEnvironmentalLimit(
  area: EnvArea,
  data: { minTemp: number; maxTemp: number; minRH: number; maxRH: number }
) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("Not authorized");

  await prisma.environmentalLimit.upsert({
    where: { area },
    update: data,
    create: { area, ...data },
  });

  await logAudit(session, {
    action: "UPDATE_ENV_LIMIT",
    entityType: "EnvironmentalLimit",
    entityId: area,
    summary: `${session.fullName} updated ${area} limits: ${JSON.stringify(data)}`,
  });

  revalidatePath(CHECKS_PATH);
}

// ───────────────────────────────── Line Clearance ─────────────────────────────

export async function createLineClearance(data: {
  date: string;
  line: string;
  previousBatchCleared: boolean;
  materialCleared: boolean;
  labelPackagingCleared: boolean;
  equipmentCleared: boolean;
  documentationVerified: boolean;
  comments?: string;
  signature: string;
}) {
  const session = await requireSession();
  if (!canActAsSupervisor(session.role) && !canActAsQa(session.role)) throw new Error("Not authorized");
  if (!data.signature.trim()) throw new Error("Signature is required");

  const check = await prisma.lineClearance.create({
    data: {
      date: new Date(`${data.date}T00:00:00Z`),
      line: data.line,
      previousBatchCleared: data.previousBatchCleared,
      materialCleared: data.materialCleared,
      labelPackagingCleared: data.labelPackagingCleared,
      equipmentCleared: data.equipmentCleared,
      documentationVerified: data.documentationVerified,
      comments: data.comments || null,
      signature: data.signature.trim(),
      submittedById: session.userId,
      submittedByName: session.fullName,
      submittedByRole: session.role,
      status: "PENDING",
    },
  });

  await logAudit(session, {
    action: "CREATE_LINE_CLEARANCE",
    entityType: "LineClearance",
    entityId: check.id,
    summary: `${session.fullName} submitted line clearance for ${data.line}`,
  });

  revalidatePath(CHECKS_PATH);
}

export async function approveLineClearance(id: string, as: "SUPERVISOR" | "QA") {
  const session = await requireSession();
  if (as === "SUPERVISOR" && !canActAsSupervisor(session.role)) throw new Error("Not authorized");
  if (as === "QA" && !canActAsQa(session.role)) throw new Error("Not authorized");

  const existing = await prisma.lineClearance.findUnique({ where: { id } });
  if (!existing) throw new Error("Record not found");
  if (existing.locked) throw new Error("This record is locked and cannot be modified");

  const data =
    as === "SUPERVISOR"
      ? {
          supervisorApprovedById: session.userId,
          supervisorApprovedByName: session.fullName,
          supervisorApprovedAt: new Date(),
        }
      : {
          qaApprovedById: session.userId,
          qaApprovedByName: session.fullName,
          qaApprovedAt: new Date(),
        };

  const bothApproved =
    (as === "SUPERVISOR" ? true : !!existing.supervisorApprovedAt) &&
    (as === "QA" ? true : !!existing.qaApprovedAt);

  await prisma.lineClearance.update({
    where: { id },
    data: {
      ...data,
      status: bothApproved ? "APPROVED" : "IN_PROGRESS",
      locked: bothApproved,
    },
  });

  await logAudit(session, {
    action: as === "SUPERVISOR" ? "SUPERVISOR_APPROVE_LINE_CLEARANCE" : "QA_APPROVE_LINE_CLEARANCE",
    entityType: "LineClearance",
    entityId: id,
    summary: `${session.fullName} approved line clearance as ${as}`,
  });

  revalidatePath(CHECKS_PATH);
}

// ───────────────────────────── Post-Operational Checks ────────────────────────

export async function createPostOpCheck(data: {
  date: string;
  item: PostOpItem;
  cleaningType: CleaningType;
  comments?: string;
  signature: string;
}) {
  const session = await requireSession();
  if (!canActAsOperator(session.role)) throw new Error("Not authorized");
  if (!data.signature.trim()) throw new Error("Signature is required");

  const check = await prisma.postOpCheck.create({
    data: {
      date: new Date(`${data.date}T00:00:00Z`),
      item: data.item,
      cleaningType: data.cleaningType,
      comments: data.comments || null,
      signature: data.signature.trim(),
      submittedById: session.userId,
      submittedByName: session.fullName,
      submittedByRole: session.role,
      status: "PENDING",
    },
  });

  await logAudit(session, {
    action: "CREATE_POST_OP_CHECK",
    entityType: "PostOpCheck",
    entityId: check.id,
    summary: `${session.fullName} submitted post-op check for ${data.item} (${data.cleaningType})`,
  });

  revalidatePath(CHECKS_PATH);
}

export async function verifyPostOpCheck(id: string, verificationStatus: string) {
  const session = await requireSession();
  if (!canActAsSupervisor(session.role)) throw new Error("Not authorized");

  const existing = await prisma.postOpCheck.findUnique({ where: { id } });
  if (!existing) throw new Error("Record not found");
  if (existing.locked) throw new Error("This record is locked and cannot be modified");

  await prisma.postOpCheck.update({
    where: { id },
    data: {
      cleaningVerificationStatus: verificationStatus,
      verifiedById: session.userId,
      verifiedByName: session.fullName,
      verifiedAt: new Date(),
      status: "APPROVED",
      locked: true,
    },
  });

  await logAudit(session, {
    action: "VERIFY_POST_OP_CHECK",
    entityType: "PostOpCheck",
    entityId: id,
    summary: `${session.fullName} verified post-op check: ${verificationStatus}`,
  });

  revalidatePath(CHECKS_PATH);
}

// ───────────────────────────────────── Work Log ────────────────────────────────

export async function createWorkLog(data: {
  room: WorkLogRoom;
  opName: string;
  startDate: string;
  startTime: string;
  productName: string;
  productCode: string;
  batchNumber: string;
  activity: WorkLogActivity;
  activityOther?: string;
  endDate?: string;
  endTime?: string;
  closingOpName?: string;
  comments?: string;
  signature: string;
}) {
  const session = await requireSession();
  if (!canActAsOperator(session.role)) throw new Error("Not authorized");
  if (!data.signature.trim()) throw new Error("Signature is required");

  const check = await prisma.workLog.create({
    data: {
      room: data.room,
      opName: data.opName.trim(),
      startDate: new Date(`${data.startDate}T00:00:00Z`),
      startTime: data.startTime,
      productName: data.productName.trim(),
      productCode: data.productCode.trim(),
      batchNumber: data.batchNumber.trim(),
      activity: data.activity,
      activityOther: data.activityOther?.trim() || null,
      endDate: data.endDate ? new Date(`${data.endDate}T00:00:00Z`) : null,
      endTime: data.endTime || null,
      closingOpName: data.closingOpName?.trim() || null,
      comments: data.comments || null,
      signature: data.signature.trim(),
      submittedById: session.userId,
      submittedByName: session.fullName,
      submittedByRole: session.role,
      status: "PENDING",
    },
  });

  await logAudit(session, {
    action: "CREATE_WORK_LOG",
    entityType: "WorkLog",
    entityId: check.id,
    summary: `${session.fullName} submitted a Work Log entry for ${data.productName} (Batch ${data.batchNumber})`,
  });

  revalidatePath(CHECKS_PATH);
}

export async function approveWorkLog(id: string) {
  const session = await requireSession();
  if (!canApproveWorkLog(session.role)) throw new Error("Not authorized");

  const existing = await prisma.workLog.findUnique({ where: { id } });
  if (!existing) throw new Error("Record not found");
  if (existing.locked) throw new Error("This record is locked and cannot be modified");

  await prisma.workLog.update({
    where: { id },
    data: {
      supervisorApprovedById: session.userId,
      supervisorApprovedByName: session.fullName,
      supervisorApprovedAt: new Date(),
      status: "APPROVED",
      locked: true,
    },
  });

  await logAudit(session, {
    action: "APPROVE_WORK_LOG",
    entityType: "WorkLog",
    entityId: id,
    summary: `${session.fullName} approved a Work Log entry`,
  });

  revalidatePath(CHECKS_PATH);
}

// ─────────────────────────────────── Unlock ────────────────────────────────────

const UNLOCK_MODELS = {
  SUPERVISOR_PREOP: () => prisma.supervisorPreOpCheck,
  QA_PREOP: () => prisma.qaPreOpCheck,
  ENVIRONMENTAL: () => prisma.environmentalCheck,
  LINE_CLEARANCE: () => prisma.lineClearance,
  POST_OP: () => prisma.postOpCheck,
  WORK_LOG: () => prisma.workLog,
} as const;

export async function unlockCheckRecord(type: keyof typeof UNLOCK_MODELS, id: string) {
  const session = await requireSession();
  if (!canUnlockChecks(session.role)) throw new Error("Not authorized");

  const model = UNLOCK_MODELS[type]();
  // @ts-expect-error -- shared shape across the five check models
  await model.update({ where: { id }, data: { locked: false } });

  await logAudit(session, {
    action: "UNLOCK_CHECK_RECORD",
    entityType: type,
    entityId: id,
    summary: `${session.fullName} unlocked a ${type} record for editing`,
  });

  revalidatePath(CHECKS_PATH);
}

/** Super Admin only: permanently delete a check record of any type, once submitted. */
export async function deleteCheckRecord(type: keyof typeof UNLOCK_MODELS, id: string) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("Not authorized");

  const model = UNLOCK_MODELS[type]();
  // @ts-expect-error -- shared shape across the five check models
  await model.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_CHECK_RECORD",
    entityType: type,
    entityId: id,
    summary: `${session.fullName} deleted a ${type} record`,
  });

  revalidatePath(CHECKS_PATH);
}
