"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession, canManageQcSamples, canCollectQcSamples, canRunLabTesting, canEdit } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formatSampleId } from "@/lib/qc-sample-defaults";
import type { QcSampleType } from "@/generated/prisma";

async function requireManageAccess() {
  const session = await getSession();
  if (!session || !canManageQcSamples(session.role)) throw new Error("Not authorized");
  return session;
}

async function requireCollectAccess() {
  const session = await getSession();
  if (!session || !canCollectQcSamples(session.role)) throw new Error("Not authorized");
  return session;
}

async function requireLabAccess() {
  const session = await getSession();
  if (!session || !canRunLabTesting(session.role)) throw new Error("Not authorized");
  return session;
}

/** The spec's "Complete Audit Trail" -- just the existing global AuditLog filtered to this sample, newest last. */
export async function getQcSampleAuditTrail(sampleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authorized");

  const entries = await prisma.auditLog.findMany({
    where: { entityType: "QcSample", entityId: sampleId },
    orderBy: { createdAt: "asc" },
  });

  return entries.map((e) => ({
    id: e.id,
    actorName: e.actorName,
    summary: e.summary,
    createdAt: e.createdAt.toISOString(),
  }));
}

type NewQcSample = {
  productName: string;
  batchNumber: string;
  batchRecordId: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  sampleType: QcSampleType;
  quantity: number;
  unit: string;
  collectionDate: string | null;
  collectionTime: string | null;
  productionRoom: string | null;
  sampleStorageLocation: string | null;
  storageTemperature: string | null;
  storageCondition: string | null;
  remarks: string | null;
};

export async function createQcSample(data: NewQcSample) {
  const session = await requireCollectAccess();
  if (!data.productName || !data.batchNumber || !data.sampleType || !data.unit) {
    throw new Error("Product, batch number, sample type, and unit are required");
  }

  const sample = await prisma.$transaction(async (tx) => {
    const created = await tx.qcSample.create({
      data: {
        sampleId: `TEMP-${randomUUID()}`,
        productName: data.productName,
        batchNumber: data.batchNumber,
        batchRecordId: data.batchRecordId,
        manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        sampleType: data.sampleType,
        quantity: data.quantity,
        unit: data.unit,
        collectedByName: session.fullName,
        collectionDate: data.collectionDate ? new Date(data.collectionDate) : null,
        collectionTime: data.collectionTime,
        productionRoom: data.productionRoom,
        sampleStorageLocation: data.sampleStorageLocation,
        storageTemperature: data.storageTemperature,
        storageCondition: data.storageCondition,
        remarks: data.remarks,
        createdByName: session.fullName,
      },
    });
    return tx.qcSample.update({
      where: { id: created.id },
      data: { sampleId: formatSampleId(created.sequence, created.createdAt) },
    });
  });

  await logAudit(session, {
    action: "CREATE_QC_SAMPLE",
    entityType: "QcSample",
    entityId: sample.id,
    summary: `Sample ${sample.sampleId} created for ${sample.productName} (batch ${sample.batchNumber})`,
  });

  revalidatePath("/qc-samples");
  return sample;
}

export async function updateQcSample(id: string, data: NewQcSample) {
  const session = await requireManageAccess();
  if (!data.productName || !data.batchNumber || !data.sampleType || !data.unit) {
    throw new Error("Product, batch number, sample type, and unit are required");
  }

  const sample = await prisma.qcSample.update({
    where: { id },
    data: {
      productName: data.productName,
      batchNumber: data.batchNumber,
      batchRecordId: data.batchRecordId,
      manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      sampleType: data.sampleType,
      quantity: data.quantity,
      unit: data.unit,
      collectionDate: data.collectionDate ? new Date(data.collectionDate) : null,
      collectionTime: data.collectionTime,
      productionRoom: data.productionRoom,
      sampleStorageLocation: data.sampleStorageLocation,
      storageTemperature: data.storageTemperature,
      storageCondition: data.storageCondition,
      remarks: data.remarks,
    },
  });

  await logAudit(session, {
    action: "UPDATE_QC_SAMPLE",
    entityType: "QcSample",
    entityId: id,
    summary: `Updated sample ${sample.sampleId}`,
  });

  revalidatePath("/qc-samples");
}

export async function markCollected(id: string) {
  const session = await requireCollectAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });
  if (sample.status !== "WAITING_COLLECTION") throw new Error("Sample is not waiting collection");

  await prisma.qcSample.update({
    where: { id },
    data: {
      status: "COLLECTED",
      collectedByName: sample.collectedByName ?? session.fullName,
      collectionDate: sample.collectionDate ?? new Date(),
    },
  });

  await logAudit(session, {
    action: "COLLECT_QC_SAMPLE",
    entityType: "QcSample",
    entityId: id,
    summary: `Sample ${sample.sampleId} collected by ${session.fullName}`,
  });

  revalidatePath("/qc-samples");
}

export async function markSentToLab(
  id: string,
  data: { sentDate: string; courierOrInternal: string | null; laboratoryName: string | null; laboratoryLocation: string | null }
) {
  const session = await requireCollectAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });
  if (sample.status !== "COLLECTED") throw new Error("Sample must be collected before it can be sent to the lab");

  await prisma.qcSample.update({
    where: { id },
    data: {
      status: "WAITING_LAB",
      sentToLab: true,
      sentDate: new Date(data.sentDate),
      courierOrInternal: data.courierOrInternal,
      laboratoryName: data.laboratoryName,
      laboratoryLocation: data.laboratoryLocation,
    },
  });

  await logAudit(session, {
    action: "SEND_QC_SAMPLE_TO_LAB",
    entityType: "QcSample",
    entityId: id,
    summary: `Sample ${sample.sampleId} sent to laboratory`,
  });

  revalidatePath("/qc-samples");
}

export async function markLabReceived(id: string) {
  const session = await requireLabAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });
  if (sample.status !== "WAITING_LAB") throw new Error("Sample has not been sent to the lab yet");

  await prisma.qcSample.update({
    where: { id },
    data: { status: "IN_LABORATORY", receivedByQcName: session.fullName, receivedDate: new Date() },
  });

  await logAudit(session, {
    action: "RECEIVE_QC_SAMPLE_AT_LAB",
    entityType: "QcSample",
    entityId: id,
    summary: `Sample ${sample.sampleId} received by ${session.fullName} at the laboratory`,
  });

  revalidatePath("/qc-samples");
}

export async function markTestingStarted(id: string) {
  const session = await requireLabAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });
  if (sample.status !== "IN_LABORATORY") throw new Error("Sample must be received at the laboratory first");

  await prisma.qcSample.update({ where: { id }, data: { status: "TESTING" } });

  await logAudit(session, {
    action: "START_QC_SAMPLE_TESTING",
    entityType: "QcSample",
    entityId: id,
    summary: `Testing started for sample ${sample.sampleId}`,
  });

  revalidatePath("/qc-samples");
}

type LabTestInput = {
  appearance: string | null;
  weightCheck: string | null;
  moisture: string | null;
  hardness: string | null;
  disintegration: string | null;
  microbiology: string | null;
  heavyMetals: string | null;
  activeIngredients: string | null;
  packagingInspection: string | null;
  labelInspection: string | null;
  photographUrls: string | null;
  coaReference: string | null;
  qcNotes: string | null;
};

export async function recordLabTestResults(id: string, data: LabTestInput) {
  const session = await requireLabAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });
  if (sample.status !== "TESTING" && sample.status !== "IN_LABORATORY") {
    throw new Error("Sample must be in the laboratory before test results can be recorded");
  }

  await prisma.$transaction([
    prisma.qcLabTest.upsert({
      where: { sampleId: id },
      create: { sampleId: id, ...data, testedByName: session.fullName, testedAt: new Date() },
      update: { ...data, testedByName: session.fullName, testedAt: new Date() },
    }),
    prisma.qcSample.update({ where: { id }, data: { status: "WAITING_RESULTS" } }),
  ]);

  await logAudit(session, {
    action: "RECORD_QC_LAB_TEST_RESULTS",
    entityType: "QcSample",
    entityId: id,
    summary: `Lab test results recorded for sample ${sample.sampleId} by ${session.fullName}`,
  });

  revalidatePath("/qc-samples");
}

export async function approveSample(id: string) {
  const session = await requireLabAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });
  if (sample.status !== "WAITING_RESULTS") throw new Error("Sample is not awaiting a result");

  await prisma.qcSample.update({ where: { id }, data: { status: "APPROVED" } });

  await logAudit(session, {
    action: "APPROVE_QC_SAMPLE",
    entityType: "QcSample",
    entityId: id,
    summary: `Sample ${sample.sampleId} approved by ${session.fullName}`,
  });

  revalidatePath("/qc-samples");
}

export async function rejectSample(id: string, reason: string) {
  const session = await requireLabAccess();
  if (!reason) throw new Error("A rejection reason is required");
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });
  if (sample.status !== "WAITING_RESULTS") throw new Error("Sample is not awaiting a result");

  await prisma.qcSample.update({
    where: { id },
    data: { status: "REJECTED", remarks: [sample.remarks, `Rejected: ${reason}`].filter(Boolean).join("\n") },
  });

  await logAudit(session, {
    action: "REJECT_QC_SAMPLE",
    entityType: "QcSample",
    entityId: id,
    summary: `Sample ${sample.sampleId} rejected by ${session.fullName}: ${reason}`,
  });

  revalidatePath("/qc-samples");
}

type RetentionInput = {
  shelf: string | null;
  cabinet: string | null;
  boxNumber: string | null;
  position: string | null;
  quantityRemaining: number | null;
};

export async function moveToRetention(id: string, data: RetentionInput) {
  const session = await requireManageAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });
  if (sample.status !== "APPROVED") throw new Error("Only an approved sample can move to retention");

  await prisma.$transaction([
    prisma.qcRetentionRecord.upsert({
      where: { sampleId: id },
      create: { sampleId: id, ...data, expiryDate: sample.expiryDate, lastChecked: new Date() },
      update: { ...data, lastChecked: new Date() },
    }),
    prisma.qcSample.update({ where: { id }, data: { status: "RETENTION" } }),
  ]);

  await logAudit(session, {
    action: "MOVE_QC_SAMPLE_TO_RETENTION",
    entityType: "QcSample",
    entityId: id,
    summary: `Sample ${sample.sampleId} moved to retention storage`,
  });

  revalidatePath("/qc-samples");
}

export async function updateRetentionRecord(
  id: string,
  data: RetentionInput & { opened: boolean; lastChecked: string | null; destroyDate: string | null }
) {
  const session = await requireManageAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });

  await prisma.qcRetentionRecord.update({
    where: { sampleId: id },
    data: {
      ...data,
      lastChecked: data.lastChecked ? new Date(data.lastChecked) : new Date(),
      destroyDate: data.destroyDate ? new Date(data.destroyDate) : null,
    },
  });

  await logAudit(session, {
    action: "UPDATE_QC_RETENTION_RECORD",
    entityType: "QcSample",
    entityId: id,
    summary: `Retention record updated for sample ${sample.sampleId}`,
  });

  revalidatePath("/qc-samples");
}

export async function markExpired(id: string) {
  const session = await requireManageAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });
  if (sample.status !== "RETENTION") throw new Error("Only a retained sample can be marked expired");

  await prisma.qcSample.update({ where: { id }, data: { status: "EXPIRED" } });

  await logAudit(session, {
    action: "EXPIRE_QC_SAMPLE",
    entityType: "QcSample",
    entityId: id,
    summary: `Sample ${sample.sampleId} marked expired`,
  });

  revalidatePath("/qc-samples");
}

export async function markDisposed(id: string) {
  const session = await requireManageAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id }, include: { retentionRecord: true } });
  if (sample.status !== "RETENTION" && sample.status !== "EXPIRED") {
    throw new Error("Only a retained or expired sample can be disposed");
  }

  await prisma.$transaction([
    prisma.qcSample.update({ where: { id }, data: { status: "DISPOSED" } }),
    ...(sample.retentionRecord && !sample.retentionRecord.destroyDate
      ? [prisma.qcRetentionRecord.update({ where: { sampleId: id }, data: { destroyDate: new Date() } })]
      : []),
  ]);

  await logAudit(session, {
    action: "DISPOSE_QC_SAMPLE",
    entityType: "QcSample",
    entityId: id,
    summary: `Sample ${sample.sampleId} disposed`,
  });

  revalidatePath("/qc-samples");
}

/** Normal delete only allowed pre-lab-result -- nothing downstream (test results, retention) depends on the
 * sample yet. Super Admin can force-delete at any stage regardless (e.g. to clean up test/mistake data);
 * cascading QcLabTest/QcRetentionRecord rows are removed automatically via the schema's onDelete: Cascade. */
export async function deleteQcSample(id: string) {
  const session = await requireManageAccess();
  const sample = await prisma.qcSample.findUniqueOrThrow({ where: { id } });
  const isForce = canEdit(session.role);

  if (!isForce && sample.status !== "WAITING_COLLECTION" && sample.status !== "COLLECTED") {
    throw new Error("Can't delete — this sample already has lab or retention history. A Super Admin can force-delete it.");
  }

  await prisma.qcSample.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_QC_SAMPLE",
    entityType: "QcSample",
    entityId: id,
    summary: isForce && sample.status !== "WAITING_COLLECTION" && sample.status !== "COLLECTED"
      ? `Force-deleted sample ${sample.sampleId} (${sample.status}) — lab/retention history removed`
      : `Deleted sample ${sample.sampleId} (never sent to lab)`,
  });

  revalidatePath("/qc-samples");
}
