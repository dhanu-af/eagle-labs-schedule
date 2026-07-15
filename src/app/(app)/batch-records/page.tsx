import { getSession, canActAsOperator, canActAsSupervisor } from "@/lib/auth";
import { listBatchRecords, getFormulationsForBatchPicker } from "@/lib/actions/batch-record-actions";
import BatchRecordsClient from "./batch-records-client";

export default async function BatchRecordsPage() {
  const session = await getSession();
  const [records, formulations] = await Promise.all([
    listBatchRecords(),
    getFormulationsForBatchPicker(),
  ]);

  return (
    <BatchRecordsClient
      canCreate={!!session && canActAsOperator(session.role)}
      canDelete={!!session && canActAsSupervisor(session.role)}
      formulations={formulations}
      records={records.map((r) => ({
        id: r.id,
        productName: r.productName,
        batchNumber: r.batchNumber,
        numberOfMixes: r.numberOfMixes,
        batchSizePerMix: r.batchSizePerMix,
        batchSizeUnit: r.batchSizeUnit,
        status: r.status,
        locked: r.locked,
        createdByName: r.createdByName,
        updatedAt: r.updatedAt.toISOString(),
      }))}
    />
  );
}
