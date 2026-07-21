"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canManageMfgReconciliation } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { DEFAULT_PACKAGING_ISSUE_LINES, DEFAULT_PACKAGING_MATERIAL_LINES } from "@/lib/mfg-reconciliation-defaults";
import type { MfgMaterialGroup, MfgPackagingMaterialType } from "@/generated/prisma";

async function requireAccess() {
  const session = await getSession();
  if (!session || !canManageMfgReconciliation(session.role)) throw new Error("Not authorized");
  return session;
}

/** Global AuditLog filtered to this batch, same convention as getQcSampleAuditTrail. */
export async function getMfgBatchAuditTrail(batchId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authorized");

  const entries = await prisma.auditLog.findMany({
    where: { entityType: "MfgBatch", entityId: batchId },
    orderBy: { createdAt: "asc" },
  });

  return entries.map((e) => ({
    id: e.id,
    actorName: e.actorName,
    summary: e.summary,
    createdAt: e.createdAt.toISOString(),
  }));
}

type RawMaterialLineSeed = { materialGroup: MfgMaterialGroup; materialCode: string | null; description: string; quantityRequested: number | null };

/** Pulls raw material lines straight from a Batch Record's own already-scaled ingredient list
 * (BatchMaterialRequestLine.kgPerBatch) -- the same figures already printed on that batch's PDF/signed
 * off by QA -- mirroring how "Create Warehouse Request" on the Batch Record page builds its line items
 * (see createWarehouseRequestFromBatchRecord in warehouse-requests-actions.ts). Ingredients aren't
 * tagged Active/Excipient anywhere upstream, so every line comes in as the generic RAW_INGREDIENT
 * group -- reclassify individual lines by hand if that distinction matters for a given batch. */
async function getRawMaterialLinesFromBatchRecord(batchRecordId: string): Promise<RawMaterialLineSeed[]> {
  const batchRecord = await prisma.batchRecord.findUnique({
    where: { id: batchRecordId },
    include: { materialRequests: { orderBy: { order: "asc" } } },
  });
  if (!batchRecord) return [];
  return batchRecord.materialRequests
    .filter((m) => m.kgPerBatch && m.kgPerBatch > 0)
    .map((m) => ({ materialGroup: "RAW_INGREDIENT" as MfgMaterialGroup, materialCode: m.rmNumber, description: m.ingredientName, quantityRequested: m.kgPerBatch }));
}

/** Creates the batch plus its Warehouse Issue and Packaging stages pre-populated. Warehouse Issue gets
 * the standard packaging material lines (same idea as QC Samples seeding its checklist from a template)
 * plus, when linked to a Batch Record, that record's raw material lines auto-added ahead of them. The
 * other five stages are created lazily by their own save* action the first time that stage is filled in. */
export async function createMfgBatch(data: { batchNumber: string; productName: string; batchRecordId: string | null }) {
  const session = await requireAccess();
  if (!data.batchNumber || !data.productName) throw new Error("Batch number and product name are required");

  const rawMaterialLines = data.batchRecordId ? await getRawMaterialLinesFromBatchRecord(data.batchRecordId) : [];

  const batch = await prisma.mfgBatch.create({
    data: {
      batchNumber: data.batchNumber,
      productName: data.productName,
      batchRecordId: data.batchRecordId,
      createdByName: session.fullName,
      warehouseIssue: {
        create: {
          lines: {
            create: [
              ...rawMaterialLines.map((line, i) => ({ ...line, sortOrder: i })),
              ...DEFAULT_PACKAGING_ISSUE_LINES.map((line, i) => ({ ...line, sortOrder: rawMaterialLines.length + i })),
            ],
          },
        },
      },
      packaging: {
        create: {
          lines: {
            create: DEFAULT_PACKAGING_MATERIAL_LINES.map((materialType, i) => ({ materialType, sortOrder: i })),
          },
        },
      },
    },
  });

  await logAudit(session, {
    action: "CREATE_MFG_BATCH",
    entityType: "MfgBatch",
    entityId: batch.id,
    summary:
      rawMaterialLines.length > 0
        ? `Manufacturing batch ${batch.batchNumber} (${batch.productName}) created, ${rawMaterialLines.length} raw material line${rawMaterialLines.length === 1 ? "" : "s"} auto-populated from Batch Record`
        : `Manufacturing batch ${batch.batchNumber} (${batch.productName}) created`,
  });

  revalidatePath("/mfg-reconciliation");
  return batch;
}

/** Adds any missing raw material lines from the linked Batch Record to an existing batch's Warehouse
 * Issue -- for batches created before auto-populate existed, or if the Batch Record's ingredient list
 * changed since. Matches by description so it never duplicates or removes anything already there. */
export async function populateWarehouseIssueFromBatchRecord(batchId: string) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { warehouseIssue: { include: { lines: true } } },
  });
  if (!batch.batchRecordId) throw new Error("This batch isn't linked to a Batch Record");
  if (!batch.warehouseIssue) throw new Error("Warehouse Issue stage hasn't been initialized for this batch");

  const rawMaterialLines = await getRawMaterialLinesFromBatchRecord(batch.batchRecordId);
  const existingDescriptions = new Set(batch.warehouseIssue.lines.map((l) => l.description));
  const newLines = rawMaterialLines.filter((l) => !existingDescriptions.has(l.description));
  if (newLines.length === 0) {
    throw new Error("No new ingredients to add -- the linked Batch Record's ingredients are already listed here.");
  }

  const maxSortOrder = batch.warehouseIssue.lines.reduce((max, l) => Math.max(max, l.sortOrder), -1);
  await prisma.mfgMaterialIssueLine.createMany({
    data: newLines.map((line, i) => ({ ...line, warehouseIssueId: batch.warehouseIssue!.id, sortOrder: maxSortOrder + 1 + i })),
  });

  await logAudit(session, {
    action: "POPULATE_MFG_WAREHOUSE_ISSUE_FROM_BATCH_RECORD",
    entityType: "MfgBatch",
    entityId: batchId,
    summary: `Added ${newLines.length} raw material line${newLines.length === 1 ? "" : "s"} to Warehouse Issue from linked Batch Record ${batch.batchNumber}`,
  });

  revalidatePath(`/mfg-reconciliation/${batchId}`);
}

export async function deleteMfgBatch(id: string) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.findUniqueOrThrow({ where: { id } });

  await prisma.mfgBatch.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_MFG_BATCH",
    entityType: "MfgBatch",
    entityId: id,
    summary: `Deleted manufacturing batch ${batch.batchNumber}`,
  });

  revalidatePath("/mfg-reconciliation");
}

export async function markMfgBatchCompleted(id: string) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.update({ where: { id }, data: { status: "COMPLETED" } });

  await logAudit(session, {
    action: "COMPLETE_MFG_BATCH",
    entityType: "MfgBatch",
    entityId: id,
    summary: `Manufacturing batch ${batch.batchNumber} marked completed`,
  });

  revalidatePath("/mfg-reconciliation");
  revalidatePath(`/mfg-reconciliation/${id}`);
}

type MaterialIssueLineInput = {
  materialGroup: MfgMaterialGroup;
  materialCode: string | null;
  description: string;
  supplier: string | null;
  lotBatchNumber: string | null;
  expiryDate: string | null;
  quantityRequested: number | null;
  quantityIssued: number | null;
  quantityReturned: number | null;
};

/** Replaces the Warehouse Issue header + all material lines wholesale, same pattern as recordLabTestResults
 * (the row set is edited as a whole table, not patched row-by-row). */
export async function saveWarehouseIssue(
  batchId: string,
  header: { issuedByName: string | null; issueDate: string | null; remarks: string | null },
  lines: MaterialIssueLineInput[]
) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.findUniqueOrThrow({ where: { id: batchId } });

  await prisma.$transaction(async (tx) => {
    const issue = await tx.mfgWarehouseIssue.upsert({
      where: { mfgBatchId: batchId },
      create: {
        mfgBatchId: batchId,
        issuedByName: header.issuedByName,
        issueDate: header.issueDate ? new Date(header.issueDate) : null,
        remarks: header.remarks,
      },
      update: {
        issuedByName: header.issuedByName,
        issueDate: header.issueDate ? new Date(header.issueDate) : null,
        remarks: header.remarks,
      },
    });
    await tx.mfgMaterialIssueLine.deleteMany({ where: { warehouseIssueId: issue.id } });
    await tx.mfgMaterialIssueLine.createMany({
      data: lines.map((line, i) => ({
        warehouseIssueId: issue.id,
        materialGroup: line.materialGroup,
        materialCode: line.materialCode,
        description: line.description,
        supplier: line.supplier,
        lotBatchNumber: line.lotBatchNumber,
        expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
        quantityRequested: line.quantityRequested,
        quantityIssued: line.quantityIssued,
        quantityReturned: line.quantityReturned,
        sortOrder: i,
      })),
    });
  });

  await logAudit(session, {
    action: "SAVE_MFG_WAREHOUSE_ISSUE",
    entityType: "MfgBatch",
    entityId: batchId,
    summary: `Warehouse Issue saved for batch ${batch.batchNumber} (${lines.length} material line${lines.length === 1 ? "" : "s"})`,
  });

  revalidatePath(`/mfg-reconciliation/${batchId}`);
}

type BlendingInput = {
  totalTheoreticalWeightKg: number | null;
  actualWeightKg: number | null;
  blendBatchNumber: string | null;
  powderRemainingKg: number | null;
  blenderResidueKg: number | null;
  sieveLossKg: number | null;
  dustLossKg: number | null;
  spillagesKg: number | null;
  qcSamplesQty: number | null;
  retentionSamplesQty: number | null;
  destroyedMaterialKg: number | null;
  returnedToWarehouseKg: number | null;
  totalBlendProducedKg: number | null;
  blendedByName: string | null;
  blendedAt: string | null;
  remarks: string | null;
};

export async function saveBlending(batchId: string, data: BlendingInput) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.findUniqueOrThrow({ where: { id: batchId } });

  await prisma.mfgBlending.upsert({
    where: { mfgBatchId: batchId },
    create: { mfgBatchId: batchId, ...data, blendedAt: data.blendedAt ? new Date(data.blendedAt) : null },
    update: { ...data, blendedAt: data.blendedAt ? new Date(data.blendedAt) : null },
  });

  await logAudit(session, {
    action: "SAVE_MFG_BLENDING",
    entityType: "MfgBatch",
    entityId: batchId,
    summary: `Blending stage saved for batch ${batch.batchNumber}`,
  });

  revalidatePath(`/mfg-reconciliation/${batchId}`);
}

type EncapsulationInput = {
  blendReceivedKg: number | null;
  blendUsedKg: number | null;
  blendRemainingKg: number | null;
  blendReturnedKg: number | null;
  powderWasteKg: number | null;
  samplingKg: number | null;
  capsuleSize: string | null;
  capsuleColour: string | null;
  capsuleLot: string | null;
  capsulesIssued: number | null;
  capsulesUsed: number | null;
  brokenCapsules: number | null;
  machineRejects: number | null;
  capsulesReturned: number | null;
  targetFillWeightMg: number | null;
  finishedCapsuleWeightMg: number | null;
  expectedCapsules: number | null;
  goodCapsules: number | null;
  rejectedCapsules: number | null;
  sampleCapsules: number | null;
  retentionCapsules: number | null;
  encapsulatedByName: string | null;
  encapsulatedAt: string | null;
  remarks: string | null;
};

export async function saveEncapsulation(batchId: string, data: EncapsulationInput) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.findUniqueOrThrow({ where: { id: batchId } });

  await prisma.mfgEncapsulation.upsert({
    where: { mfgBatchId: batchId },
    create: { mfgBatchId: batchId, ...data, encapsulatedAt: data.encapsulatedAt ? new Date(data.encapsulatedAt) : null },
    update: { ...data, encapsulatedAt: data.encapsulatedAt ? new Date(data.encapsulatedAt) : null },
  });

  await logAudit(session, {
    action: "SAVE_MFG_ENCAPSULATION",
    entityType: "MfgBatch",
    entityId: batchId,
    summary: `Encapsulation stage saved for batch ${batch.batchNumber}`,
  });

  revalidatePath(`/mfg-reconciliation/${batchId}`);
}

type BottlingInput = {
  capsulesReceived: number | null;
  capsulesUsed: number | null;
  capsulesRemaining: number | null;
  bottlesIssued: number | null;
  bottlesUsed: number | null;
  damagedBottles: number | null;
  bottlesReturned: number | null;
  capsIssued: number | null;
  capsUsed: number | null;
  damagedCaps: number | null;
  capsReturned: number | null;
  desiccantsIssued: number | null;
  desiccantsUsed: number | null;
  damagedDesiccants: number | null;
  desiccantsReturned: number | null;
  bottleSize: string | null;
  targetCapsulesPerBottle: number | null;
  expectedBottles: number | null;
  filledBottles: number | null;
  rejectedBottles: number | null;
  qcSampleBottles: number | null;
  retentionBottles: number | null;
  bottledByName: string | null;
  bottledAt: string | null;
  remarks: string | null;
};

export async function saveBottling(batchId: string, data: BottlingInput) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.findUniqueOrThrow({ where: { id: batchId } });

  await prisma.mfgBottling.upsert({
    where: { mfgBatchId: batchId },
    create: { mfgBatchId: batchId, ...data, bottledAt: data.bottledAt ? new Date(data.bottledAt) : null },
    update: { ...data, bottledAt: data.bottledAt ? new Date(data.bottledAt) : null },
  });

  await logAudit(session, {
    action: "SAVE_MFG_BOTTLING",
    entityType: "MfgBatch",
    entityId: batchId,
    summary: `Bottling stage saved for batch ${batch.batchNumber}`,
  });

  revalidatePath(`/mfg-reconciliation/${batchId}`);
}

type XrayInspectionInput = {
  bottlesReceived: number | null;
  bottlesScanned: number | null;
  passed: number | null;
  failed: number | null;
  reworked: number | null;
  destroyed: number | null;
  released: number | null;
  rejectMetalDetection: number | null;
  rejectXrayFailure: number | null;
  rejectUnderweight: number | null;
  rejectOverweight: number | null;
  rejectDamagedBottle: number | null;
  rejectMissingCap: number | null;
  rejectMissingDesiccant: number | null;
  inspectedByName: string | null;
  inspectedAt: string | null;
  remarks: string | null;
};

export async function saveXrayInspection(batchId: string, data: XrayInspectionInput) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.findUniqueOrThrow({ where: { id: batchId } });

  await prisma.mfgXrayInspection.upsert({
    where: { mfgBatchId: batchId },
    create: { mfgBatchId: batchId, ...data, inspectedAt: data.inspectedAt ? new Date(data.inspectedAt) : null },
    update: { ...data, inspectedAt: data.inspectedAt ? new Date(data.inspectedAt) : null },
  });

  await logAudit(session, {
    action: "SAVE_MFG_XRAY_INSPECTION",
    entityType: "MfgBatch",
    entityId: batchId,
    summary: `X-Ray/Metal Detection stage saved for batch ${batch.batchNumber}`,
  });

  revalidatePath(`/mfg-reconciliation/${batchId}`);
}

type PackagingMaterialLineInput = {
  materialType: MfgPackagingMaterialType;
  issued: number | null;
  used: number | null;
  damaged: number | null;
  returned: number | null;
  destroyed: number | null;
};

export async function savePackaging(
  batchId: string,
  header: { packedBottles: number | null; cartonsProduced: number | null; casesProduced: number | null; packedByName: string | null; packedAt: string | null; remarks: string | null },
  lines: PackagingMaterialLineInput[]
) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.findUniqueOrThrow({ where: { id: batchId } });

  await prisma.$transaction(async (tx) => {
    const packaging = await tx.mfgPackaging.upsert({
      where: { mfgBatchId: batchId },
      create: {
        mfgBatchId: batchId,
        packedBottles: header.packedBottles,
        cartonsProduced: header.cartonsProduced,
        casesProduced: header.casesProduced,
        packedByName: header.packedByName,
        packedAt: header.packedAt ? new Date(header.packedAt) : null,
        remarks: header.remarks,
      },
      update: {
        packedBottles: header.packedBottles,
        cartonsProduced: header.cartonsProduced,
        casesProduced: header.casesProduced,
        packedByName: header.packedByName,
        packedAt: header.packedAt ? new Date(header.packedAt) : null,
        remarks: header.remarks,
      },
    });
    await tx.mfgPackagingMaterialLine.deleteMany({ where: { packagingId: packaging.id } });
    await tx.mfgPackagingMaterialLine.createMany({
      data: lines.map((line, i) => ({ packagingId: packaging.id, ...line, sortOrder: i })),
    });
  });

  await logAudit(session, {
    action: "SAVE_MFG_PACKAGING",
    entityType: "MfgBatch",
    entityId: batchId,
    summary: `Packaging stage saved for batch ${batch.batchNumber}`,
  });

  revalidatePath(`/mfg-reconciliation/${batchId}`);
}

type FinishedGoodsWarehouseInput = {
  finishedGoodsReceived: number | null;
  qaReleased: boolean;
  qaReleasedByName: string | null;
  qaReleasedAt: string | null;
  storageLocation: string | null;
  warehouseBalance: number | null;
  batchNumber: string | null;
  expiryDate: string | null;
  remarks: string | null;
};

export async function saveFinishedGoodsWarehouse(batchId: string, data: FinishedGoodsWarehouseInput) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.findUniqueOrThrow({ where: { id: batchId } });

  await prisma.mfgFinishedGoodsWarehouse.upsert({
    where: { mfgBatchId: batchId },
    create: {
      mfgBatchId: batchId,
      ...data,
      qaReleasedAt: data.qaReleasedAt ? new Date(data.qaReleasedAt) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
    },
    update: {
      ...data,
      qaReleasedAt: data.qaReleasedAt ? new Date(data.qaReleasedAt) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
    },
  });

  await logAudit(session, {
    action: "SAVE_MFG_FG_WAREHOUSE",
    entityType: "MfgBatch",
    entityId: batchId,
    summary: `Finished Goods Warehouse stage saved for batch ${batch.batchNumber}`,
  });

  revalidatePath(`/mfg-reconciliation/${batchId}`);
}

type DispatchEventInput = {
  customer: string;
  salesOrder: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  casesDispatched: number | null;
  bottlesDispatched: number | null;
  dispatchDate: string | null;
  remainingStockAfter: number | null;
  remarks: string | null;
};

export async function addDispatchEvent(batchId: string, data: DispatchEventInput) {
  const session = await requireAccess();
  if (!data.customer) throw new Error("Customer is required");
  const batch = await prisma.mfgBatch.findUniqueOrThrow({ where: { id: batchId } });

  await prisma.mfgDispatchEvent.create({
    data: {
      mfgBatchId: batchId,
      customer: data.customer,
      salesOrder: data.salesOrder,
      batchNumber: data.batchNumber,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      casesDispatched: data.casesDispatched,
      bottlesDispatched: data.bottlesDispatched,
      dispatchDate: data.dispatchDate ? new Date(data.dispatchDate) : null,
      remainingStockAfter: data.remainingStockAfter,
      dispatchedByName: session.fullName,
      remarks: data.remarks,
    },
  });

  await logAudit(session, {
    action: "ADD_MFG_DISPATCH_EVENT",
    entityType: "MfgBatch",
    entityId: batchId,
    summary: `Dispatch recorded for batch ${batch.batchNumber} to ${data.customer}`,
  });

  revalidatePath(`/mfg-reconciliation/${batchId}`);
}

export async function deleteDispatchEvent(batchId: string, dispatchEventId: string) {
  const session = await requireAccess();
  const batch = await prisma.mfgBatch.findUniqueOrThrow({ where: { id: batchId } });

  await prisma.mfgDispatchEvent.delete({ where: { id: dispatchEventId } });

  await logAudit(session, {
    action: "DELETE_MFG_DISPATCH_EVENT",
    entityType: "MfgBatch",
    entityId: batchId,
    summary: `Dispatch event removed for batch ${batch.batchNumber}`,
  });

  revalidatePath(`/mfg-reconciliation/${batchId}`);
}
