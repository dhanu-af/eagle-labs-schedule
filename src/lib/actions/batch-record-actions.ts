"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canActAsOperator, canActAsSupervisor } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const BASE_PATH = "/batch-records";

async function requireOperator() {
  const session = await getSession();
  if (!session || !canActAsOperator(session.role)) throw new Error("Not authorized");
  return session;
}

async function requireSupervisor() {
  const session = await getSession();
  if (!session || !canActAsSupervisor(session.role)) throw new Error("Not authorized");
  return session;
}

export async function listBatchRecords() {
  return prisma.batchRecord.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      productName: true,
      batchNumber: true,
      numberOfMixes: true,
      batchSizePerMix: true,
      batchSizeUnit: true,
      status: true,
      locked: true,
      createdByName: true,
      updatedAt: true,
    },
  });
}

export async function getFormulationsForBatchPicker() {
  return prisma.formulation.findMany({
    select: { id: true, productName: true, baseBatchSize: true, baseUnit: true },
    orderBy: { productName: "asc" },
  });
}

/** Mass units the app converts between — mirrors formulation-detail-client.tsx's Batch Calculator. */
const UNIT_TO_MG: Record<string, number> = { mg: 1, g: 1000, kg: 1_000_000 };

function toMg(value: number, unit: string) {
  const key = unit.trim().toLowerCase();
  return key in UNIT_TO_MG ? value * UNIT_TO_MG[key] : value;
}

function fromMg(valueMg: number, unit: string) {
  const key = unit.trim().toLowerCase();
  return key in UNIT_TO_MG ? valueMg / UNIT_TO_MG[key] : valueMg;
}

export async function createBatchRecordFromFormulation(input: {
  formulationId: string;
  batchNumber: string;
  numberOfMixes: number;
  batchSizePerMix: number;
  batchSizeUnit: string;
}) {
  const session = await requireOperator();
  if (!input.batchNumber.trim()) throw new Error("Batch number is required");
  if (input.numberOfMixes < 1) throw new Error("Number of mixes must be at least 1");
  if (input.batchSizePerMix <= 0) throw new Error("Batch size per mix must be greater than 0");

  const formulation = await prisma.formulation.findUnique({
    where: { id: input.formulationId },
    include: { ingredients: { orderBy: { order: "asc" } } },
  });
  if (!formulation) throw new Error("Formulation not found");

  // Formulations are often authored at dose scale (e.g. mg per capsule) while a
  // production batch is recorded in bulk units (e.g. kg) — convert through a
  // common unit (mg) rather than assuming both sides share the same unit.
  const targetBatchSizeMg = toMg(input.batchSizePerMix, input.batchSizeUnit);
  const formulationBaseMg = toMg(formulation.baseBatchSize, formulation.baseUnit);
  const scale = targetBatchSizeMg / formulationBaseMg;

  const lines = formulation.ingredients.map((ing) => {
    const ingBaseMg = toMg(ing.baseQty, formulation.baseUnit);
    const requiredKg = fromMg(ingBaseMg * scale, "kg");
    return {
      rmNumber: ing.rmNumber,
      ingredientName: ing.ingredientName,
      uin: ing.uin,
      requiredQtyKg: Math.round(requiredKg * 1000) / 1000,
    };
  });

  const batch = await prisma.batchRecord.create({
    data: {
      formulationId: formulation.id,
      productName: formulation.productName,
      batchNumber: input.batchNumber.trim(),
      numberOfMixes: input.numberOfMixes,
      batchSizePerMix: input.batchSizePerMix,
      batchSizeUnit: input.batchSizeUnit,
      createdById: session.userId,
      createdByName: session.fullName,
      mixes: {
        create: Array.from({ length: input.numberOfMixes }, (_, i) => ({
          mixNumber: i + 1,
          dispensingLines: { create: lines.map((l, order) => ({ ...l, order })) },
        })),
      },
      warehouseReturns: {
        create: lines.map((l, order) => ({
          order,
          rmNumber: l.rmNumber,
          ingredientName: l.ingredientName,
          uin: l.uin,
          kgPerBatch: l.requiredQtyKg,
          qtyUsedKg: Math.round(l.requiredQtyKg * input.numberOfMixes * 1000) / 1000,
        })),
      },
      materialRequests: {
        create: lines.map((l, order) => ({
          order,
          rmNumber: l.rmNumber,
          ingredientName: l.ingredientName,
          uin: l.uin,
          kgPerBatch: l.requiredQtyKg,
          qtyReleasedKg: Math.round(l.requiredQtyKg * input.numberOfMixes * 1000) / 1000,
        })),
      },
    },
  });

  await logAudit(session, {
    action: "CREATE_BATCH_RECORD",
    entityType: "BatchRecord",
    entityId: batch.id,
    summary: `Started Batch Manufacturing Record for "${batch.productName}" batch ${batch.batchNumber} (${input.numberOfMixes} mix${input.numberOfMixes > 1 ? "es" : ""} × ${input.batchSizePerMix} ${formulation.baseUnit})`,
  });

  revalidatePath(BASE_PATH);
  return batch;
}

export async function getBatchRecord(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authorized");

  return prisma.batchRecord.findUnique({
    where: { id },
    include: {
      workLogEntries: { orderBy: { rowNumber: "asc" } },
      operators: { orderBy: { rowNumber: "asc" } },
      equipment: { orderBy: { rowNumber: "asc" } },
      lineClearance: true,
      mixes: {
        orderBy: { mixNumber: "asc" },
        include: {
          dispensingLines: { orderBy: { order: "asc" } },
          drums: true,
        },
      },
      warehouseReturns: { orderBy: { order: "asc" } },
      materialRequests: { orderBy: { order: "asc" } },
    },
  });
}

export type BatchHeaderInput = {
  writtenByName?: string;
  writtenSignedDate?: string;
  checkedByName?: string;
  checkedSignedDate?: string;
  reviewDate?: string;
  notes?: string;
  declEncapsulation: boolean;
  declBlendingMixing: boolean;
  declDispensing: boolean;
  declPolishing: boolean;
  declCoating: boolean;
  releasedByWarehouse?: string;
  releasedDate?: string;
  requestCheckedBy?: string;
  ailsNumber?: string;
  palletNumber?: string;
};

export type WorkLogEntryInput = {
  date?: string;
  operatorName?: string;
  processNumber?: number;
  startTime?: string;
  finishTime?: string;
  breakMinutes?: number;
  totalHours?: number;
  sign?: string;
};

export type OperatorSignoffInput = { name?: string; signature?: string; date?: string };

export type EquipmentItemInput = { eqNumber?: string; itemName?: string; calibrationUpdated?: string; notes?: string };

export type LineClearanceInput = {
  roomNumber?: string;
  roomCleanType?: string;
  equipmentCleanType?: string;
  performedBySign?: string;
  performedByDate?: string;
  performedByTime?: string;
  verifiedBySign?: string;
  verifiedByDate?: string;
  verifiedByTime?: string;
  probioticProduct: boolean;
  roomRhPercent?: number;
  roomRhTime?: string;
  roomTemperature?: number;
  roomTempTime?: string;
  roomUseApprovalSign?: string;
  roomUseApprovalDate?: string;
  materialsIdentifiedChecked: boolean;
  materialsPassLabelledChecked: boolean;
};

export type MixUpdateInput = {
  dispensingStartDate?: string;
  dispensingStartTime?: string;
  dispensingStartSign?: string;
  dispensingEndDate?: string;
  dispensingEndTime?: string;
  dispensingEndSign?: string;
  blendingStartDate?: string;
  blendingStartTime?: string;
  blendingStartSign?: string;
  blendingEndDate?: string;
  blendingEndTime?: string;
  blendingEndSign?: string;
  mixCompletedSign?: string;
  mixCompletedDate?: string;
  mixCompletedTime?: string;
  verifiedBySign?: string;
  verifiedByDate?: string;
  verifiedByTime?: string;
  samplesRejectsSpillsKg?: number;
  bulkSampleWeightG?: number;
  bulkVolumeMl?: number;
  tappedVolumeMl?: number;
  dispensingLines: { id: string; actualQtyDispensedKg?: number; performedBySign?: string; performedByDate?: string; verifiedBySign?: string; verifiedByDate?: string }[];
  drums: { drumNumber?: string; netWeightKg?: number; passLabelAttached: boolean }[];
};

export type WarehouseReturnLineInput = { actualQtyReturnedKg?: number; operatorSign?: string; operatorDate?: string };
export type MaterialRequestLineInput = { actualQtyReceivedKg?: number; operatorSign?: string; operatorDate?: string };

function toDate(s: string | undefined) {
  return s ? new Date(s) : null;
}

export async function saveBatchRecord(
  id: string,
  data: {
    header: BatchHeaderInput;
    workLogEntries: WorkLogEntryInput[];
    operators: OperatorSignoffInput[];
    equipment: EquipmentItemInput[];
    lineClearance: LineClearanceInput;
    mixes: Record<string, MixUpdateInput>;
    warehouseReturns: Record<string, WarehouseReturnLineInput>;
    materialRequests: Record<string, MaterialRequestLineInput>;
  }
) {
  const session = await requireOperator();

  const existing = await prisma.batchRecord.findUnique({ where: { id } });
  if (!existing) throw new Error("Batch record not found");
  if (existing.locked) throw new Error("This record is locked and can't be edited");

  await prisma.$transaction(async (tx) => {
    await tx.batchRecord.update({
      where: { id },
      data: {
        writtenByName: data.header.writtenByName || null,
        writtenSignedDate: toDate(data.header.writtenSignedDate),
        checkedByName: data.header.checkedByName || null,
        checkedSignedDate: toDate(data.header.checkedSignedDate),
        reviewDate: toDate(data.header.reviewDate),
        notes: data.header.notes || null,
        declEncapsulation: data.header.declEncapsulation,
        declBlendingMixing: data.header.declBlendingMixing,
        declDispensing: data.header.declDispensing,
        declPolishing: data.header.declPolishing,
        declCoating: data.header.declCoating,
        releasedByWarehouse: data.header.releasedByWarehouse || null,
        releasedDate: toDate(data.header.releasedDate),
        requestCheckedBy: data.header.requestCheckedBy || null,
        ailsNumber: data.header.ailsNumber || null,
        palletNumber: data.header.palletNumber || null,
      },
    });

    await tx.batchWorkLogEntry.deleteMany({ where: { batchRecordId: id } });
    if (data.workLogEntries.length) {
      await tx.batchWorkLogEntry.createMany({
        data: data.workLogEntries.map((w, rowNumber) => ({
          batchRecordId: id,
          rowNumber,
          date: toDate(w.date),
          operatorName: w.operatorName || null,
          processNumber: w.processNumber ?? null,
          startTime: w.startTime || null,
          finishTime: w.finishTime || null,
          breakMinutes: w.breakMinutes ?? null,
          totalHours: w.totalHours ?? null,
          sign: w.sign || null,
        })),
      });
    }

    await tx.batchOperatorSignoff.deleteMany({ where: { batchRecordId: id } });
    if (data.operators.length) {
      await tx.batchOperatorSignoff.createMany({
        data: data.operators.map((o, rowNumber) => ({
          batchRecordId: id,
          rowNumber,
          name: o.name || null,
          signature: o.signature || null,
          date: toDate(o.date),
        })),
      });
    }

    await tx.batchEquipmentItem.deleteMany({ where: { batchRecordId: id } });
    if (data.equipment.length) {
      await tx.batchEquipmentItem.createMany({
        data: data.equipment.map((e, rowNumber) => ({
          batchRecordId: id,
          rowNumber,
          eqNumber: e.eqNumber || null,
          itemName: e.itemName || null,
          calibrationUpdated: e.calibrationUpdated || null,
          notes: e.notes || null,
        })),
      });
    }

    await tx.batchLineClearance.upsert({
      where: { batchRecordId: id },
      create: {
        batchRecordId: id,
        roomNumber: data.lineClearance.roomNumber || null,
        roomCleanType: data.lineClearance.roomCleanType || null,
        equipmentCleanType: data.lineClearance.equipmentCleanType || null,
        performedBySign: data.lineClearance.performedBySign || null,
        performedByDate: toDate(data.lineClearance.performedByDate),
        performedByTime: data.lineClearance.performedByTime || null,
        verifiedBySign: data.lineClearance.verifiedBySign || null,
        verifiedByDate: toDate(data.lineClearance.verifiedByDate),
        verifiedByTime: data.lineClearance.verifiedByTime || null,
        probioticProduct: data.lineClearance.probioticProduct,
        roomRhPercent: data.lineClearance.roomRhPercent ?? null,
        roomRhTime: data.lineClearance.roomRhTime || null,
        roomTemperature: data.lineClearance.roomTemperature ?? null,
        roomTempTime: data.lineClearance.roomTempTime || null,
        roomUseApprovalSign: data.lineClearance.roomUseApprovalSign || null,
        roomUseApprovalDate: toDate(data.lineClearance.roomUseApprovalDate),
        materialsIdentifiedChecked: data.lineClearance.materialsIdentifiedChecked,
        materialsPassLabelledChecked: data.lineClearance.materialsPassLabelledChecked,
      },
      update: {
        roomNumber: data.lineClearance.roomNumber || null,
        roomCleanType: data.lineClearance.roomCleanType || null,
        equipmentCleanType: data.lineClearance.equipmentCleanType || null,
        performedBySign: data.lineClearance.performedBySign || null,
        performedByDate: toDate(data.lineClearance.performedByDate),
        performedByTime: data.lineClearance.performedByTime || null,
        verifiedBySign: data.lineClearance.verifiedBySign || null,
        verifiedByDate: toDate(data.lineClearance.verifiedByDate),
        verifiedByTime: data.lineClearance.verifiedByTime || null,
        probioticProduct: data.lineClearance.probioticProduct,
        roomRhPercent: data.lineClearance.roomRhPercent ?? null,
        roomRhTime: data.lineClearance.roomRhTime || null,
        roomTemperature: data.lineClearance.roomTemperature ?? null,
        roomTempTime: data.lineClearance.roomTempTime || null,
        roomUseApprovalSign: data.lineClearance.roomUseApprovalSign || null,
        roomUseApprovalDate: toDate(data.lineClearance.roomUseApprovalDate),
        materialsIdentifiedChecked: data.lineClearance.materialsIdentifiedChecked,
        materialsPassLabelledChecked: data.lineClearance.materialsPassLabelledChecked,
      },
    });

    for (const [mixId, mix] of Object.entries(data.mixes)) {
      await tx.batchMix.update({
        where: { id: mixId },
        data: {
          dispensingStartDate: toDate(mix.dispensingStartDate),
          dispensingStartTime: mix.dispensingStartTime || null,
          dispensingStartSign: mix.dispensingStartSign || null,
          dispensingEndDate: toDate(mix.dispensingEndDate),
          dispensingEndTime: mix.dispensingEndTime || null,
          dispensingEndSign: mix.dispensingEndSign || null,
          blendingStartDate: toDate(mix.blendingStartDate),
          blendingStartTime: mix.blendingStartTime || null,
          blendingStartSign: mix.blendingStartSign || null,
          blendingEndDate: toDate(mix.blendingEndDate),
          blendingEndTime: mix.blendingEndTime || null,
          blendingEndSign: mix.blendingEndSign || null,
          mixCompletedSign: mix.mixCompletedSign || null,
          mixCompletedDate: toDate(mix.mixCompletedDate),
          mixCompletedTime: mix.mixCompletedTime || null,
          verifiedBySign: mix.verifiedBySign || null,
          verifiedByDate: toDate(mix.verifiedByDate),
          verifiedByTime: mix.verifiedByTime || null,
          samplesRejectsSpillsKg: mix.samplesRejectsSpillsKg ?? null,
          bulkSampleWeightG: mix.bulkSampleWeightG ?? null,
          bulkVolumeMl: mix.bulkVolumeMl ?? null,
          tappedVolumeMl: mix.tappedVolumeMl ?? null,
        },
      });

      for (const line of mix.dispensingLines) {
        await tx.batchDispensingLine.update({
          where: { id: line.id },
          data: {
            actualQtyDispensedKg: line.actualQtyDispensedKg ?? null,
            performedBySign: line.performedBySign || null,
            performedByDate: toDate(line.performedByDate),
            verifiedBySign: line.verifiedBySign || null,
            verifiedByDate: toDate(line.verifiedByDate),
          },
        });
      }

      await tx.batchDrum.deleteMany({ where: { mixId } });
      if (mix.drums.length) {
        await tx.batchDrum.createMany({
          data: mix.drums.map((d) => ({
            mixId,
            drumNumber: d.drumNumber || null,
            netWeightKg: d.netWeightKg ?? null,
            passLabelAttached: d.passLabelAttached,
          })),
        });
      }
    }

    for (const [lineId, line] of Object.entries(data.warehouseReturns)) {
      await tx.batchWarehouseReturnLine.update({
        where: { id: lineId },
        data: {
          actualQtyReturnedKg: line.actualQtyReturnedKg ?? null,
          operatorSign: line.operatorSign || null,
          operatorDate: toDate(line.operatorDate),
        },
      });
    }

    for (const [lineId, line] of Object.entries(data.materialRequests)) {
      await tx.batchMaterialRequestLine.update({
        where: { id: lineId },
        data: {
          actualQtyReceivedKg: line.actualQtyReceivedKg ?? null,
          operatorSign: line.operatorSign || null,
          operatorDate: toDate(line.operatorDate),
        },
      });
    }
  });

  await logAudit(session, {
    action: "UPDATE_BATCH_RECORD",
    entityType: "BatchRecord",
    entityId: id,
    summary: `Updated Batch Manufacturing Record for "${existing.productName}" batch ${existing.batchNumber}`,
  });

  revalidatePath(`${BASE_PATH}/${id}`);
}

export async function lockBatchRecord(id: string) {
  const session = await requireSupervisor();
  const batch = await prisma.batchRecord.update({
    where: { id },
    data: { status: "APPROVED", locked: true },
  });

  await logAudit(session, {
    action: "LOCK_BATCH_RECORD",
    entityType: "BatchRecord",
    entityId: id,
    summary: `Approved and locked Batch Manufacturing Record for "${batch.productName}" batch ${batch.batchNumber}`,
  });

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${id}`);
}

export async function unlockBatchRecord(id: string) {
  const session = await requireSupervisor();
  const batch = await prisma.batchRecord.update({
    where: { id },
    data: { status: "IN_PROGRESS", locked: false },
  });

  await logAudit(session, {
    action: "UNLOCK_BATCH_RECORD",
    entityType: "BatchRecord",
    entityId: id,
    summary: `Unlocked Batch Manufacturing Record for "${batch.productName}" batch ${batch.batchNumber}`,
  });

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${id}`);
}

export async function deleteBatchRecord(id: string) {
  const session = await requireSupervisor();
  const batch = await prisma.batchRecord.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_BATCH_RECORD",
    entityType: "BatchRecord",
    entityId: id,
    summary: `Deleted Batch Manufacturing Record for "${batch.productName}" batch ${batch.batchNumber}`,
  });

  revalidatePath(BASE_PATH);
}
