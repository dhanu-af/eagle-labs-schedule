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
              targetCapsuleFillWeightMg: batch.encapsulation.targetCapsuleFillWeightMg,
              avgCapsuleFullWeightMg: batch.encapsulation.avgCapsuleFullWeightMg,
              issuedBulkBlendKg: batch.encapsulation.issuedBulkBlendKg,
              capsulesProducedKg: batch.encapsulation.capsulesProducedKg,
              capsuleSamplesKg: batch.encapsulation.capsuleSamplesKg,
              rejectCapsulesKg: batch.encapsulation.rejectCapsulesKg,
              rejectPowderKg: batch.encapsulation.rejectPowderKg,
              avgCapsuleFillWeightMg: batch.encapsulation.avgCapsuleFillWeightMg,
              avgCapsuleLengthMm: batch.encapsulation.avgCapsuleLengthMm,
              avgDisintegrationMinutes: batch.encapsulation.avgDisintegrationMinutes,
              avgDisintegrationSeconds: batch.encapsulation.avgDisintegrationSeconds,
              disintegrationResult: batch.encapsulation.disintegrationResult,
              completedByName: batch.encapsulation.completedByName,
              completedAt: batch.encapsulation.completedAt?.toISOString() ?? null,
              checkedByName: batch.encapsulation.checkedByName,
              checkedAt: batch.encapsulation.checkedAt?.toISOString() ?? null,
              comments: batch.encapsulation.comments,
            }
          : null,
        bottling: batch.bottling
          ? {
              totalCapsuleBulkWeightKg: batch.bottling.totalCapsuleBulkWeightKg,
              avgCapsuleFullWeightMg: batch.bottling.avgCapsuleFullWeightMg,
              plannedQuantityBottles: batch.bottling.plannedQuantityBottles,
              capsuleReceivedKg: batch.bottling.capsuleReceivedKg,
              bottlesProduced: batch.bottling.bottlesProduced,
              bottleUsed: batch.bottling.bottleUsed,
              desiccantsUsed: batch.bottling.desiccantsUsed,
              capsUsed: batch.bottling.capsUsed,
              targetCapsulesPerBottle: batch.bottling.targetCapsulesPerBottle,
              completedByName: batch.bottling.completedByName,
              completedAt: batch.bottling.completedAt?.toISOString() ?? null,
              checkedByName: batch.bottling.checkedByName,
              checkedAt: batch.bottling.checkedAt?.toISOString() ?? null,
              comments: batch.bottling.comments,
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
