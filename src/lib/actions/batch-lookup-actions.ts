"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toDateInputValueUTC } from "@/lib/ui";

export type BatchHistoryEntry = {
  id: string;
  at: string;
  actorName: string;
  action: string;
  summary: string;
  source: "Daily Operations" | "Production Staging Operations" | "Batch Record";
  href: string | null;
};

/**
 * Finds every record tied to a batch number across Daily Operations, Production Staging
 * Operations (drying room), and Batch Records, then merges their audit history into one
 * chronological timeline. Exact match only (case-insensitive) -- a loose/partial match here
 * would silently mix up unrelated batches.
 */
export async function searchBatchHistory(batchNumberRaw: string): Promise<{ found: boolean; timeline: BatchHistoryEntry[] }> {
  const session = await getSession();
  if (!session) throw new Error("Not authorized");

  const batchNumber = batchNumberRaw.trim();
  if (!batchNumber) return { found: false, timeline: [] };

  const [dailyTasks, dryingBatches, batchRecords] = await Promise.all([
    prisma.dailyTask.findMany({ where: { batchNo: { equals: batchNumber, mode: "insensitive" } } }),
    prisma.dryingBatch.findMany({ where: { batchNumber: { equals: batchNumber, mode: "insensitive" } } }),
    prisma.batchRecord.findMany({ where: { batchNumber: { equals: batchNumber, mode: "insensitive" } } }),
  ]);

  if (dailyTasks.length === 0 && dryingBatches.length === 0 && batchRecords.length === 0) {
    return { found: false, timeline: [] };
  }

  const dailyTaskHref = new Map(dailyTasks.map((t) => [t.id, `/daily?date=${toDateInputValueUTC(t.date)}`]));
  const dryingBatchHref = new Map(dryingBatches.map((b) => [b.id, b.bayId ? `/drying-room?bay=${b.bayId}` : "/drying-room"]));
  const batchRecordHref = new Map(batchRecords.map((r) => [r.id, `/batch-records/${r.id}`]));

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "DailyTask", entityId: { in: [...dailyTaskHref.keys()] } },
        { entityType: "DryingBatch", entityId: { in: [...dryingBatchHref.keys()] } },
        { entityType: "BatchRecord", entityId: { in: [...batchRecordHref.keys()] } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  const timeline: BatchHistoryEntry[] = logs.map((l) => {
    const source =
      l.entityType === "DailyTask" ? "Daily Operations" : l.entityType === "DryingBatch" ? "Production Staging Operations" : "Batch Record";
    const href =
      l.entityType === "DailyTask"
        ? dailyTaskHref.get(l.entityId ?? "") ?? null
        : l.entityType === "DryingBatch"
          ? dryingBatchHref.get(l.entityId ?? "") ?? null
          : batchRecordHref.get(l.entityId ?? "") ?? null;

    return {
      id: l.id,
      at: l.createdAt.toISOString(),
      actorName: l.actorName,
      action: l.action,
      summary: l.summary,
      source,
      href,
    };
  });

  return { found: true, timeline };
}
