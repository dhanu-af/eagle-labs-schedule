import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canManageMfgReconciliation } from "@/lib/auth";
import MfgBatchDetailClient from "./mfg-batch-detail-client";

export default async function MfgBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const batch = await prisma.mfgBatch.findUnique({
    where: { id },
    include: {
      batchRecord: { select: { productName: true, batchNumber: true } },
      warehouseIssue: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
      blending: true,
      encapsulation: true,
      bottling: true,
      xrayInspection: true,
      packaging: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
      finishedGoodsWarehouse: true,
      dispatchEvents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!batch) notFound();

  return (
    <MfgBatchDetailClient
      batch={{
        id: batch.id,
        batchNumber: batch.batchNumber,
        productName: batch.productName,
        status: batch.status,
        remarks: batch.remarks,
        batchRecordLabel: batch.batchRecord ? `${batch.batchRecord.batchNumber} — ${batch.batchRecord.productName}` : null,
        createdAt: batch.createdAt.toISOString(),
        warehouseIssue: batch.warehouseIssue
          ? {
              issuedByName: batch.warehouseIssue.issuedByName,
              issueDate: batch.warehouseIssue.issueDate?.toISOString() ?? null,
              remarks: batch.warehouseIssue.remarks,
              lines: batch.warehouseIssue.lines.map((l) => ({
                materialGroup: l.materialGroup,
                materialCode: l.materialCode,
                description: l.description,
                supplier: l.supplier,
                lotBatchNumber: l.lotBatchNumber,
                expiryDate: l.expiryDate?.toISOString() ?? null,
                quantityRequested: l.quantityRequested,
                quantityIssued: l.quantityIssued,
                quantityReturned: l.quantityReturned,
              })),
            }
          : null,
        blending: batch.blending
          ? {
              totalTheoreticalWeightKg: batch.blending.totalTheoreticalWeightKg,
              actualWeightKg: batch.blending.actualWeightKg,
              blendBatchNumber: batch.blending.blendBatchNumber,
              powderRemainingKg: batch.blending.powderRemainingKg,
              blenderResidueKg: batch.blending.blenderResidueKg,
              sieveLossKg: batch.blending.sieveLossKg,
              dustLossKg: batch.blending.dustLossKg,
              spillagesKg: batch.blending.spillagesKg,
              qcSamplesQty: batch.blending.qcSamplesQty,
              retentionSamplesQty: batch.blending.retentionSamplesQty,
              destroyedMaterialKg: batch.blending.destroyedMaterialKg,
              returnedToWarehouseKg: batch.blending.returnedToWarehouseKg,
              totalBlendProducedKg: batch.blending.totalBlendProducedKg,
              blendedByName: batch.blending.blendedByName,
              blendedAt: batch.blending.blendedAt?.toISOString() ?? null,
              remarks: batch.blending.remarks,
            }
          : null,
        encapsulation: batch.encapsulation
          ? {
              blendReceivedKg: batch.encapsulation.blendReceivedKg,
              blendUsedKg: batch.encapsulation.blendUsedKg,
              blendRemainingKg: batch.encapsulation.blendRemainingKg,
              blendReturnedKg: batch.encapsulation.blendReturnedKg,
              powderWasteKg: batch.encapsulation.powderWasteKg,
              samplingKg: batch.encapsulation.samplingKg,
              capsuleSize: batch.encapsulation.capsuleSize,
              capsuleColour: batch.encapsulation.capsuleColour,
              capsuleLot: batch.encapsulation.capsuleLot,
              capsulesIssued: batch.encapsulation.capsulesIssued,
              capsulesUsed: batch.encapsulation.capsulesUsed,
              brokenCapsules: batch.encapsulation.brokenCapsules,
              machineRejects: batch.encapsulation.machineRejects,
              capsulesReturned: batch.encapsulation.capsulesReturned,
              targetFillWeightMg: batch.encapsulation.targetFillWeightMg,
              expectedCapsules: batch.encapsulation.expectedCapsules,
              goodCapsules: batch.encapsulation.goodCapsules,
              rejectedCapsules: batch.encapsulation.rejectedCapsules,
              sampleCapsules: batch.encapsulation.sampleCapsules,
              retentionCapsules: batch.encapsulation.retentionCapsules,
              encapsulatedByName: batch.encapsulation.encapsulatedByName,
              encapsulatedAt: batch.encapsulation.encapsulatedAt?.toISOString() ?? null,
              remarks: batch.encapsulation.remarks,
            }
          : null,
        bottling: batch.bottling
          ? {
              capsulesReceived: batch.bottling.capsulesReceived,
              capsulesUsed: batch.bottling.capsulesUsed,
              capsulesRemaining: batch.bottling.capsulesRemaining,
              bottlesIssued: batch.bottling.bottlesIssued,
              bottlesUsed: batch.bottling.bottlesUsed,
              damagedBottles: batch.bottling.damagedBottles,
              bottlesReturned: batch.bottling.bottlesReturned,
              capsIssued: batch.bottling.capsIssued,
              capsUsed: batch.bottling.capsUsed,
              damagedCaps: batch.bottling.damagedCaps,
              capsReturned: batch.bottling.capsReturned,
              desiccantsIssued: batch.bottling.desiccantsIssued,
              desiccantsUsed: batch.bottling.desiccantsUsed,
              damagedDesiccants: batch.bottling.damagedDesiccants,
              desiccantsReturned: batch.bottling.desiccantsReturned,
              bottleSize: batch.bottling.bottleSize,
              targetCapsulesPerBottle: batch.bottling.targetCapsulesPerBottle,
              expectedBottles: batch.bottling.expectedBottles,
              filledBottles: batch.bottling.filledBottles,
              rejectedBottles: batch.bottling.rejectedBottles,
              qcSampleBottles: batch.bottling.qcSampleBottles,
              retentionBottles: batch.bottling.retentionBottles,
              bottledByName: batch.bottling.bottledByName,
              bottledAt: batch.bottling.bottledAt?.toISOString() ?? null,
              remarks: batch.bottling.remarks,
            }
          : null,
        xrayInspection: batch.xrayInspection
          ? {
              bottlesReceived: batch.xrayInspection.bottlesReceived,
              bottlesScanned: batch.xrayInspection.bottlesScanned,
              passed: batch.xrayInspection.passed,
              failed: batch.xrayInspection.failed,
              reworked: batch.xrayInspection.reworked,
              destroyed: batch.xrayInspection.destroyed,
              released: batch.xrayInspection.released,
              rejectMetalDetection: batch.xrayInspection.rejectMetalDetection,
              rejectXrayFailure: batch.xrayInspection.rejectXrayFailure,
              rejectUnderweight: batch.xrayInspection.rejectUnderweight,
              rejectOverweight: batch.xrayInspection.rejectOverweight,
              rejectDamagedBottle: batch.xrayInspection.rejectDamagedBottle,
              rejectMissingCap: batch.xrayInspection.rejectMissingCap,
              rejectMissingDesiccant: batch.xrayInspection.rejectMissingDesiccant,
              inspectedByName: batch.xrayInspection.inspectedByName,
              inspectedAt: batch.xrayInspection.inspectedAt?.toISOString() ?? null,
              remarks: batch.xrayInspection.remarks,
            }
          : null,
        packaging: batch.packaging
          ? {
              packedBottles: batch.packaging.packedBottles,
              cartonsProduced: batch.packaging.cartonsProduced,
              casesProduced: batch.packaging.casesProduced,
              packedByName: batch.packaging.packedByName,
              packedAt: batch.packaging.packedAt?.toISOString() ?? null,
              remarks: batch.packaging.remarks,
              lines: batch.packaging.lines.map((l) => ({
                materialType: l.materialType,
                issued: l.issued,
                used: l.used,
                damaged: l.damaged,
                returned: l.returned,
                destroyed: l.destroyed,
              })),
            }
          : null,
        finishedGoodsWarehouse: batch.finishedGoodsWarehouse
          ? {
              finishedGoodsReceived: batch.finishedGoodsWarehouse.finishedGoodsReceived,
              qaReleased: batch.finishedGoodsWarehouse.qaReleased,
              qaReleasedByName: batch.finishedGoodsWarehouse.qaReleasedByName,
              qaReleasedAt: batch.finishedGoodsWarehouse.qaReleasedAt?.toISOString() ?? null,
              storageLocation: batch.finishedGoodsWarehouse.storageLocation,
              warehouseBalance: batch.finishedGoodsWarehouse.warehouseBalance,
              batchNumber: batch.finishedGoodsWarehouse.batchNumber,
              expiryDate: batch.finishedGoodsWarehouse.expiryDate?.toISOString() ?? null,
              remarks: batch.finishedGoodsWarehouse.remarks,
            }
          : null,
        dispatchEvents: batch.dispatchEvents.map((d) => ({
          id: d.id,
          customer: d.customer,
          salesOrder: d.salesOrder,
          batchNumber: d.batchNumber,
          expiryDate: d.expiryDate?.toISOString() ?? null,
          casesDispatched: d.casesDispatched,
          bottlesDispatched: d.bottlesDispatched,
          dispatchDate: d.dispatchDate?.toISOString() ?? null,
          remainingStockAfter: d.remainingStockAfter,
          dispatchedByName: d.dispatchedByName,
          remarks: d.remarks,
        })),
      }}
      canManage={!!session && canManageMfgReconciliation(session.role)}
    />
  );
}
