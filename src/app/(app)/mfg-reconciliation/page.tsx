import { prisma } from "@/lib/prisma";
import { getSession, canManageMfgReconciliation } from "@/lib/auth";
import MfgReconciliationClient from "./mfg-reconciliation-client";

export default async function MfgReconciliationPage() {
  const session = await getSession();

  const [batches, batchRecords] = await Promise.all([
    prisma.mfgBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        blending: true,
        encapsulation: true,
        bottling: true,
        finishedGoodsWarehouse: true,
      },
    }),
    prisma.batchRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, productName: true, batchNumber: true },
    }),
  ]);

  return (
    <MfgReconciliationClient
      batches={batches.map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        productName: b.productName,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        blending: b.blending
          ? { totalTheoreticalWeightKg: b.blending.totalTheoreticalWeightKg, totalBlendProducedKg: b.blending.totalBlendProducedKg }
          : null,
        encapsulation: b.encapsulation
          ? { expectedCapsules: b.encapsulation.expectedCapsules, goodCapsules: b.encapsulation.goodCapsules }
          : null,
        bottling: b.bottling ? { expectedBottles: b.bottling.expectedBottles, filledBottles: b.bottling.filledBottles } : null,
        qaReleased: b.finishedGoodsWarehouse?.qaReleased ?? false,
      }))}
      batchRecords={batchRecords}
      canManage={!!session && canManageMfgReconciliation(session.role)}
    />
  );
}
