import { prisma } from "@/lib/prisma";
import type { StockBucket } from "@/generated/prisma";

const BUCKETS: StockBucket[] = [
  "AVAILABLE",
  "RESERVED",
  "IN_PRODUCTION",
  "AWAITING_VERIFICATION",
  "EXPIRED",
  "DAMAGED",
  "BLOCKED",
];

export type StockSummary = Record<StockBucket, number> & { QUARANTINE: number };

/** Full recompute over the ledger -- the source of truth, always correct even if a cached resultingBalance ever drifts. Scope to one lot by passing lotNumber. */
export async function getItemStockSummary(itemId: string, lotNumber?: string | null): Promise<StockSummary> {
  const entries = await prisma.materialLedgerEntry.findMany({
    where: { itemId, ...(lotNumber ? { lotNumber } : {}) },
    select: { fromBucket: true, toBucket: true, quantity: true },
  });

  const buckets = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<StockBucket, number>;
  for (const e of entries) {
    if (e.toBucket) buckets[e.toBucket] += e.quantity;
    if (e.fromBucket) buckets[e.fromBucket] -= e.quantity;
  }

  const quarantine = await prisma.goodsReceivingLine.aggregate({
    where: { itemId, status: "QUARANTINE", ...(lotNumber ? { lotNumber } : {}) },
    _sum: { quantity: true },
  });

  return { ...buckets, QUARANTINE: quarantine._sum.quantity ?? 0 };
}

/** O(1) read of the AVAILABLE balance via the ledger's own cached column, falling back to 0 when no entries exist yet. */
export async function getAvailableBalance(itemId: string, lotNumber?: string | null): Promise<number> {
  const latest = await prisma.materialLedgerEntry.findFirst({
    where: { itemId, ...(lotNumber ? { lotNumber } : {}) },
    orderBy: { sequence: "desc" },
    select: { resultingBalance: true },
  });
  return latest?.resultingBalance ?? 0;
}

/** Computes the resultingBalance to store on a new ledger row -- call this BEFORE creating the row, with that row's own from/to bucket effect on AVAILABLE. */
export async function computeResultingBalance(
  itemId: string,
  lotNumber: string | null,
  fromBucket: StockBucket | null,
  toBucket: StockBucket | null,
  quantity: number
): Promise<number> {
  let balance = await getAvailableBalance(itemId, lotNumber);
  if (toBucket === "AVAILABLE") balance += quantity;
  if (fromBucket === "AVAILABLE") balance -= quantity;
  return balance;
}
