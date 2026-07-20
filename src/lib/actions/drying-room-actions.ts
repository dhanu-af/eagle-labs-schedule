"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canUpdateDailyProgress, canManageDryingRoom } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateMorningReportText } from "@/lib/generate-morning-report";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import type { DryingBayPurpose, DryingStage, TrolleyQcStatus } from "@/generated/prisma";

async function requireOperatorAccess() {
  const session = await getSession();
  if (!session || !canUpdateDailyProgress(session.role)) throw new Error("Not authorized");
  return session;
}

async function requireManagerAccess() {
  const session = await getSession();
  if (!session || !canManageDryingRoom(session.role)) throw new Error("Not authorized");
  return session;
}

export async function createBay() {
  const session = await requireManagerAccess();

  const highest = await prisma.dryingBay.findFirst({ orderBy: { bayNumber: "desc" } });
  const bayNumber = (highest?.bayNumber ?? 0) + 1;

  const bay = await prisma.dryingBay.create({ data: { bayNumber, updatedBy: session.fullName } });

  await logAudit(session, {
    action: "CREATE_DRYING_BAY",
    entityType: "DryingBay",
    entityId: bay.id,
    summary: `Added Bay ${bayNumber}`,
  });

  revalidatePath("/drying-room");
  return { id: bay.id, bayNumber };
}

export async function updateBayPurpose(
  bayId: string,
  data: {
    purpose: DryingBayPurpose;
    assignedEmployeeId: string | null;
    department: string | null;
    comments: string | null;
    expectedFinishTime: string | null;
  }
) {
  const session = await requireOperatorAccess();

  await prisma.dryingBay.update({
    where: { id: bayId },
    data: {
      purpose: data.purpose,
      assignedEmployeeId: data.assignedEmployeeId,
      department: data.department,
      comments: data.comments,
      expectedFinishTime: data.expectedFinishTime ? new Date(data.expectedFinishTime) : null,
      updatedBy: session.fullName,
    },
  });

  await logAudit(session, {
    action: "UPDATE_DRYING_BAY",
    entityType: "DryingBay",
    entityId: bayId,
    summary: `Set bay purpose to ${data.purpose}`,
  });

  revalidatePath("/drying-room");
}

export async function createBatch(
  bayId: string | null,
  data: {
    productName: string;
    batchNumber: string;
    batchSize: number;
    batchSizeUnit: string;
    numberOfTrolleys: number;
    trayCount: number;
    dateEnteredDryingRoom: string;
    dryingStartTime: string | null;
    assignedEmployeeId: string | null;
    priorityRank: number | null;
  }
) {
  const session = await requireOperatorAccess();

  if (!data.productName || !data.batchNumber) throw new Error("Product name and batch number are required");

  const batch = await prisma.dryingBatch.create({
    data: {
      bayId,
      productName: data.productName,
      batchNumber: data.batchNumber,
      batchSize: data.batchSize,
      batchSizeUnit: data.batchSizeUnit,
      numberOfTrolleys: data.numberOfTrolleys,
      trayCount: data.trayCount,
      dateEnteredDryingRoom: new Date(data.dateEnteredDryingRoom),
      dryingStartTime: data.dryingStartTime ? new Date(data.dryingStartTime) : null,
      assignedEmployeeId: data.assignedEmployeeId,
      priorityRank: data.priorityRank,
      updatedBy: session.fullName,
      trolleys: {
        create: Array.from({ length: Math.max(1, data.numberOfTrolleys) }, (_, i) => ({ trolleyNumber: i + 1 })),
      },
    },
  });

  await logAudit(session, {
    action: "CREATE_DRYING_BATCH",
    entityType: "DryingBatch",
    entityId: batch.id,
    summary: `Added batch ${data.productName} · ${data.batchNumber} (${data.numberOfTrolleys} trolleys)`,
  });

  revalidatePath("/drying-room");
}

export async function deleteBatch(batchId: string) {
  const session = await requireManagerAccess();

  await prisma.dryingBatch.delete({ where: { id: batchId } });

  await logAudit(session, {
    action: "DELETE_DRYING_BATCH",
    entityType: "DryingBatch",
    entityId: batchId,
    summary: `Removed batch ${batchId}`,
  });

  revalidatePath("/drying-room");
}

export async function moveBatchToBay(batchId: string, bayId: string | null) {
  const session = await requireOperatorAccess();

  await prisma.dryingBatch.update({ where: { id: batchId }, data: { bayId, updatedBy: session.fullName } });

  await logAudit(session, {
    action: "MOVE_DRYING_BATCH",
    entityType: "DryingBatch",
    entityId: batchId,
    summary: bayId ? `Moved batch ${batchId} to bay ${bayId}` : `Unassigned batch ${batchId} from its bay`,
  });

  revalidatePath("/drying-room");
}

export async function updateBatchPriority(batchId: string, priorityRank: number | null) {
  const session = await requireOperatorAccess();

  await prisma.dryingBatch.update({ where: { id: batchId }, data: { priorityRank, updatedBy: session.fullName } });

  await logAudit(session, {
    action: "UPDATE_DRYING_BATCH_PRIORITY",
    entityType: "DryingBatch",
    entityId: batchId,
    summary: priorityRank ? `Set batch ${batchId} to priority ${priorityRank}` : `Cleared priority on batch ${batchId}`,
  });

  revalidatePath("/drying-room");
}

export async function updateBatchRemarks(batchId: string, remarks: string | null) {
  const session = await requireOperatorAccess();

  await prisma.dryingBatch.update({ where: { id: batchId }, data: { remarks, updatedBy: session.fullName } });

  await logAudit(session, {
    action: "UPDATE_DRYING_BATCH_REMARKS",
    entityType: "DryingBatch",
    entityId: batchId,
    summary: `Updated remarks on batch ${batchId}`,
  });

  revalidatePath("/drying-room");
}

export async function updateBatchStage(batchId: string, stage: DryingStage) {
  const session = await requireOperatorAccess();

  await prisma.dryingBatch.update({
    where: { id: batchId },
    data: {
      currentStage: stage,
      stageUpdatedAt: new Date(),
      completedAt: stage === "COMPLETE" ? new Date() : null,
      updatedBy: session.fullName,
    },
  });

  await logAudit(session, {
    action: "UPDATE_DRYING_BATCH_STAGE",
    entityType: "DryingBatch",
    entityId: batchId,
    summary: `Set batch ${batchId} to ${stage}`,
  });

  revalidatePath("/drying-room");
}

export async function updateTrolley(
  trolleyId: string,
  data: {
    quantity: number | null;
    trayCount: number | null;
    wrapped: boolean;
    rotationCompleted: boolean;
    qcStatus: TrolleyQcStatus;
    assignedEmployeeId: string | null;
    remarks: string | null;
  }
) {
  const session = await requireOperatorAccess();

  await prisma.dryingTrolley.update({ where: { id: trolleyId }, data });

  await logAudit(session, {
    action: "UPDATE_DRYING_TROLLEY",
    entityType: "DryingTrolley",
    entityId: trolleyId,
    summary: `Updated trolley ${trolleyId}`,
  });

  revalidatePath("/drying-room");
}

export async function upsertMiscStorageItem(
  id: string | null,
  data: {
    product: string;
    batchNumber: string | null;
    quantityLabel: string;
    storageType: string | null;
    status: string | null;
    requiredAction: string | null;
    location: string | null;
    remarks: string | null;
  }
) {
  const session = await requireOperatorAccess();

  if (!data.product || !data.quantityLabel) throw new Error("Product and quantity are required");

  if (id) {
    await prisma.miscStorageItem.update({ where: { id }, data: { ...data, updatedBy: session.fullName } });
  } else {
    await prisma.miscStorageItem.create({ data: { ...data, updatedBy: session.fullName } });
  }

  await logAudit(session, {
    action: id ? "UPDATE_MISC_STORAGE_ITEM" : "CREATE_MISC_STORAGE_ITEM",
    entityType: "MiscStorageItem",
    entityId: id ?? undefined,
    summary: `${id ? "Updated" : "Added"} misc storage item: ${data.product}`,
  });

  revalidatePath("/drying-room");
}

export async function deleteMiscStorageItem(id: string) {
  const session = await requireManagerAccess();

  await prisma.miscStorageItem.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_MISC_STORAGE_ITEM",
    entityType: "MiscStorageItem",
    entityId: id,
    summary: `Removed misc storage item ${id}`,
  });

  revalidatePath("/drying-room");
}

/**
 * V1 stub: no WhatsApp Business API/Twilio credentials exist in this project yet, so this
 * records the send (report text + target) as an audit entry instead of making a real
 * network call. Swapping in a real send later only touches this function. Target is either
 * a saved group or an ad hoc phone number.
 */
export async function sendMorningReportToWhatsApp(target: { groupId: string | null; phoneNumber: string | null }) {
  const session = await requireOperatorAccess();

  let targetLabel: string;
  let phoneNumber: string;
  if (target.groupId) {
    const group = await prisma.whatsAppGroup.findUnique({ where: { id: target.groupId } });
    if (!group) throw new Error("WhatsApp group not found");
    if (!group.identifier) {
      throw new Error(
        `"${group.name}" has no phone number set — WhatsApp's Business API can only message individual numbers, not real groups. Add a number for this target first.`
      );
    }
    targetLabel = group.name;
    phoneNumber = group.identifier;
  } else if (target.phoneNumber) {
    targetLabel = target.phoneNumber;
    phoneNumber = target.phoneNumber;
  } else {
    throw new Error("Select a group or enter a phone number");
  }

  const [bays, misc] = await Promise.all([
    prisma.dryingBay.findMany({
      orderBy: { bayNumber: "asc" },
      include: { batches: { where: { completedAt: null } } },
    }),
    prisma.miscStorageItem.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const reportText = generateMorningReportText(bays, misc);
  const result = await sendWhatsAppMessage(phoneNumber, reportText);

  if (result.sent) {
    await logAudit(session, {
      action: "SEND_MORNING_REPORT_WHATSAPP",
      entityType: target.groupId ? "WhatsAppGroup" : "WhatsAppNumber",
      entityId: target.groupId ?? undefined,
      summary: `Sent Morning Report to "${targetLabel}" via WhatsApp:\n${reportText}`,
    });
    return { ok: true, target: targetLabel, reportText, sent: true };
  }

  if (result.reason === "api_error") {
    await logAudit(session, {
      action: "SEND_MORNING_REPORT_WHATSAPP_FAILED",
      entityType: target.groupId ? "WhatsAppGroup" : "WhatsAppNumber",
      entityId: target.groupId ?? undefined,
      summary: `Failed to send Morning Report to "${targetLabel}": ${result.error}`,
    });
    throw new Error(`WhatsApp send failed: ${result.error}`);
  }

  // Not configured yet -- record the intent instead of a real send.
  await logAudit(session, {
    action: "SEND_MORNING_REPORT_WHATSAPP",
    entityType: target.groupId ? "WhatsAppGroup" : "WhatsAppNumber",
    entityId: target.groupId ?? undefined,
    summary: `Sent Morning Report to "${targetLabel}" (stub — no WhatsApp integration configured yet):\n${reportText}`,
  });

  return { ok: true, target: targetLabel, reportText, sent: false };
}
