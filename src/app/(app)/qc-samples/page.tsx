import { prisma } from "@/lib/prisma";
import { getSession, canManageQcSamples, canCollectQcSamples, canRunLabTesting, canEdit } from "@/lib/auth";
import QcSamplesClient from "./qc-samples-client";

export default async function QcSamplesPage() {
  const session = await getSession();

  const [samples, batchRecords, bays, locations] = await Promise.all([
    prisma.qcSample.findMany({
      orderBy: { createdAt: "desc" },
      include: { labTest: true, retentionRecord: true },
    }),
    prisma.batchRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, productName: true, batchNumber: true },
    }),
    prisma.dryingBay.findMany({ orderBy: { bayNumber: "asc" }, select: { bayNumber: true } }),
    prisma.warehouseLocation.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: { code: true, label: true },
    }),
  ]);

  const bayOptions = bays.map((b) => `Bay ${b.bayNumber}`);
  const locationOptions = locations.map((l) => `${l.code} — ${l.label}`);

  return (
    <QcSamplesClient
      samples={samples.map((s) => ({
        id: s.id,
        sampleId: s.sampleId,
        productName: s.productName,
        batchNumber: s.batchNumber,
        batchRecordId: s.batchRecordId,
        manufacturingDate: s.manufacturingDate?.toISOString() ?? null,
        expiryDate: s.expiryDate?.toISOString() ?? null,
        sampleType: s.sampleType,
        quantity: s.quantity,
        unit: s.unit,
        collectedByName: s.collectedByName,
        collectionDate: s.collectionDate?.toISOString() ?? null,
        collectionTime: s.collectionTime,
        productionRoom: s.productionRoom,
        sampleStorageLocation: s.sampleStorageLocation,
        storageTemperature: s.storageTemperature,
        storageCondition: s.storageCondition,
        sentToLab: s.sentToLab,
        sentDate: s.sentDate?.toISOString() ?? null,
        courierOrInternal: s.courierOrInternal,
        laboratoryName: s.laboratoryName,
        laboratoryLocation: s.laboratoryLocation,
        receivedByQcName: s.receivedByQcName,
        receivedDate: s.receivedDate?.toISOString() ?? null,
        status: s.status,
        remarks: s.remarks,
        createdByName: s.createdByName,
        createdAt: s.createdAt.toISOString(),
        labTest: s.labTest
          ? {
              appearance: s.labTest.appearance,
              weightCheck: s.labTest.weightCheck,
              moisture: s.labTest.moisture,
              hardness: s.labTest.hardness,
              disintegration: s.labTest.disintegration,
              microbiology: s.labTest.microbiology,
              heavyMetals: s.labTest.heavyMetals,
              activeIngredients: s.labTest.activeIngredients,
              packagingInspection: s.labTest.packagingInspection,
              labelInspection: s.labTest.labelInspection,
              photographUrls: s.labTest.photographUrls,
              coaReference: s.labTest.coaReference,
              qcNotes: s.labTest.qcNotes,
              testedByName: s.labTest.testedByName,
              testedAt: s.labTest.testedAt?.toISOString() ?? null,
            }
          : null,
        retentionRecord: s.retentionRecord
          ? {
              shelf: s.retentionRecord.shelf,
              cabinet: s.retentionRecord.cabinet,
              boxNumber: s.retentionRecord.boxNumber,
              position: s.retentionRecord.position,
              quantityRemaining: s.retentionRecord.quantityRemaining,
              opened: s.retentionRecord.opened,
              lastChecked: s.retentionRecord.lastChecked?.toISOString() ?? null,
              expiryDate: s.retentionRecord.expiryDate?.toISOString() ?? null,
              destroyDate: s.retentionRecord.destroyDate?.toISOString() ?? null,
            }
          : null,
      }))}
      batchRecords={batchRecords}
      bayOptions={bayOptions}
      locationOptions={locationOptions}
      canCollect={!!session && canCollectQcSamples(session.role)}
      canManage={!!session && canManageQcSamples(session.role)}
      canRunLabTesting={!!session && canRunLabTesting(session.role)}
      isSuperAdmin={!!session && canEdit(session.role)}
    />
  );
}
