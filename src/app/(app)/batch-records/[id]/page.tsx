import { notFound } from "next/navigation";
import { getSession, canActAsOperator, canActAsSupervisor, canRequestMaterials } from "@/lib/auth";
import { getBatchRecord } from "@/lib/actions/batch-record-actions";
import BatchRecordClient from "./batch-record-client";

export default async function BatchRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const batch = await getBatchRecord(id);
  if (!batch) notFound();

  return (
    <BatchRecordClient
      canEdit={!!session && canActAsOperator(session.role) && !batch.locked}
      canLock={!!session && canActAsSupervisor(session.role)}
      canRequestWarehouse={!!session && canRequestMaterials(session.role)}
      currentUserName={session?.fullName ?? ""}
      batch={{
        id: batch.id,
        productName: batch.productName,
        batchNumber: batch.batchNumber,
        numberOfMixes: batch.numberOfMixes,
        batchSizePerMix: batch.batchSizePerMix,
        batchSizeUnit: batch.batchSizeUnit,
        status: batch.status,
        locked: batch.locked,
        writtenByName: batch.writtenByName,
        writtenSignedDate: batch.writtenSignedDate?.toISOString().slice(0, 10) ?? null,
        checkedByName: batch.checkedByName,
        checkedSignedDate: batch.checkedSignedDate?.toISOString().slice(0, 10) ?? null,
        reviewDate: batch.reviewDate?.toISOString().slice(0, 10) ?? null,
        notes: batch.notes,
        declEncapsulation: batch.declEncapsulation,
        declBlendingMixing: batch.declBlendingMixing,
        declDispensing: batch.declDispensing,
        declPolishing: batch.declPolishing,
        declCoating: batch.declCoating,
        releasedByWarehouse: batch.releasedByWarehouse,
        releasedDate: batch.releasedDate?.toISOString().slice(0, 10) ?? null,
        requestCheckedBy: batch.requestCheckedBy,
        ailsNumber: batch.ailsNumber,
        palletNumber: batch.palletNumber,
        workLogEntries: batch.workLogEntries.map((w) => ({
          id: w.id,
          date: w.date?.toISOString().slice(0, 10) ?? null,
          operatorName: w.operatorName,
          processNumber: w.processNumber,
          startTime: w.startTime,
          finishTime: w.finishTime,
          breakMinutes: w.breakMinutes,
          totalHours: w.totalHours,
          sign: w.sign,
        })),
        operators: batch.operators.map((o) => ({
          id: o.id,
          name: o.name,
          signature: o.signature,
          date: o.date?.toISOString().slice(0, 10) ?? null,
        })),
        equipment: batch.equipment.map((e) => ({
          id: e.id,
          eqNumber: e.eqNumber,
          itemName: e.itemName,
          calibrationUpdated: e.calibrationUpdated,
          notes: e.notes,
        })),
        lineClearance: batch.lineClearance
          ? {
              roomNumber: batch.lineClearance.roomNumber,
              roomCleanType: batch.lineClearance.roomCleanType,
              equipmentCleanType: batch.lineClearance.equipmentCleanType,
              performedBySign: batch.lineClearance.performedBySign,
              performedByDate: batch.lineClearance.performedByDate?.toISOString().slice(0, 10) ?? null,
              performedByTime: batch.lineClearance.performedByTime,
              verifiedBySign: batch.lineClearance.verifiedBySign,
              verifiedByDate: batch.lineClearance.verifiedByDate?.toISOString().slice(0, 10) ?? null,
              verifiedByTime: batch.lineClearance.verifiedByTime,
              probioticProduct: batch.lineClearance.probioticProduct,
              roomRhPercent: batch.lineClearance.roomRhPercent,
              roomRhTime: batch.lineClearance.roomRhTime,
              roomTemperature: batch.lineClearance.roomTemperature,
              roomTempTime: batch.lineClearance.roomTempTime,
              roomUseApprovalSign: batch.lineClearance.roomUseApprovalSign,
              roomUseApprovalDate: batch.lineClearance.roomUseApprovalDate?.toISOString().slice(0, 10) ?? null,
              materialsIdentifiedChecked: batch.lineClearance.materialsIdentifiedChecked,
              materialsPassLabelledChecked: batch.lineClearance.materialsPassLabelledChecked,
            }
          : null,
        mixes: batch.mixes.map((m) => ({
          id: m.id,
          mixNumber: m.mixNumber,
          dispensingStartDate: m.dispensingStartDate?.toISOString().slice(0, 10) ?? null,
          dispensingStartTime: m.dispensingStartTime,
          dispensingStartSign: m.dispensingStartSign,
          dispensingEndDate: m.dispensingEndDate?.toISOString().slice(0, 10) ?? null,
          dispensingEndTime: m.dispensingEndTime,
          dispensingEndSign: m.dispensingEndSign,
          blendingStartDate: m.blendingStartDate?.toISOString().slice(0, 10) ?? null,
          blendingStartTime: m.blendingStartTime,
          blendingStartSign: m.blendingStartSign,
          blendingEndDate: m.blendingEndDate?.toISOString().slice(0, 10) ?? null,
          blendingEndTime: m.blendingEndTime,
          blendingEndSign: m.blendingEndSign,
          mixCompletedSign: m.mixCompletedSign,
          mixCompletedDate: m.mixCompletedDate?.toISOString().slice(0, 10) ?? null,
          mixCompletedTime: m.mixCompletedTime,
          verifiedBySign: m.verifiedBySign,
          verifiedByDate: m.verifiedByDate?.toISOString().slice(0, 10) ?? null,
          verifiedByTime: m.verifiedByTime,
          samplesRejectsSpillsKg: m.samplesRejectsSpillsKg,
          bulkSampleWeightG: m.bulkSampleWeightG,
          bulkVolumeMl: m.bulkVolumeMl,
          tappedVolumeMl: m.tappedVolumeMl,
          dispensingLines: m.dispensingLines.map((l) => ({
            id: l.id,
            rmNumber: l.rmNumber,
            ingredientName: l.ingredientName,
            uin: l.uin,
            requiredQtyKg: l.requiredQtyKg,
            actualQtyDispensedKg: l.actualQtyDispensedKg,
            performedBySign: l.performedBySign,
            performedByDate: l.performedByDate?.toISOString().slice(0, 10) ?? null,
            verifiedBySign: l.verifiedBySign,
            verifiedByDate: l.verifiedByDate?.toISOString().slice(0, 10) ?? null,
          })),
          drums: m.drums.map((d) => ({
            id: d.id,
            drumNumber: d.drumNumber,
            netWeightKg: d.netWeightKg,
            passLabelAttached: d.passLabelAttached,
          })),
        })),
        warehouseReturns: batch.warehouseReturns.map((w) => ({
          id: w.id,
          rmNumber: w.rmNumber,
          ingredientName: w.ingredientName,
          uin: w.uin,
          kgPerBatch: w.kgPerBatch,
          qtyUsedKg: w.qtyUsedKg,
          actualQtyReturnedKg: w.actualQtyReturnedKg,
          operatorSign: w.operatorSign,
          operatorDate: w.operatorDate?.toISOString().slice(0, 10) ?? null,
        })),
        materialRequests: batch.materialRequests.map((m) => ({
          id: m.id,
          rmNumber: m.rmNumber,
          ingredientName: m.ingredientName,
          uin: m.uin,
          kgPerBatch: m.kgPerBatch,
          qtyReleasedKg: m.qtyReleasedKg,
          actualQtyReceivedKg: m.actualQtyReceivedKg,
          operatorSign: m.operatorSign,
          operatorDate: m.operatorDate?.toISOString().slice(0, 10) ?? null,
        })),
      }}
    />
  );
}
